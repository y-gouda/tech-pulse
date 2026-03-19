import { XMLParser } from 'fast-xml-parser';

export interface ParsedArticle {
  title: string;
  url: string;
  summary: string;
  author: string;
  publishedAt: string;
  thumbnailUrl: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: true,
  htmlEntities: true,
});

function isSafeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch {}
  return '';
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')        // HTML comments
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '') // CDATA sections
    .replace(/<style[\s\S]*?<\/style>/gi, '') // style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '') // script blocks
    .replace(/<[^>]*>/g, '')                 // remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function extractLink(link: unknown): string {
  if (typeof link === 'string') return link;
  if (Array.isArray(link)) {
    const alternate = link.find(
      (l: Record<string, unknown>) => l['@_rel'] === 'alternate' || !l['@_rel']
    );
    const target = alternate || link[0];
    return typeof target === 'string' ? target : (target?.['@_href'] as string) ?? '';
  }
  if (link && typeof link === 'object') {
    return (link as Record<string, string>)['@_href'] ?? '';
  }
  return '';
}

function extractDate(item: Record<string, unknown>): string {
  const raw =
    item['pubDate'] ??
    item['published'] ??
    item['updated'] ??
    item['dc:date'] ??
    '';
  if (!raw) return new Date().toISOString();
  try {
    return new Date(raw as string).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function extractThumbnail(item: Record<string, unknown>): string {
  const mediaThumbnail = item['media:thumbnail'] as Record<string, string> | undefined;
  if (mediaThumbnail?.['@_url']) return mediaThumbnail['@_url'];

  const mediaContent = item['media:content'] as Record<string, string> | undefined;
  if (mediaContent?.['@_url'] && mediaContent?.['@_medium'] === 'image') {
    return mediaContent['@_url'];
  }

  const enclosure = item['enclosure'] as Record<string, string> | undefined;
  if (enclosure?.['@_type']?.startsWith('image/') && enclosure?.['@_url']) {
    return enclosure['@_url'];
  }

  return '';
}

function extractSummary(item: Record<string, unknown>): string {
  const raw =
    item['description'] ??
    item['summary'] ??
    item['content'] ??
    item['content:encoded'] ??
    '';
  const text = typeof raw === 'string' ? raw : '';
  return truncate(stripHtmlTags(text), 300);
}

function extractAuthor(item: Record<string, unknown>): string {
  const author = item['author'] ?? item['dc:creator'] ?? '';
  if (typeof author === 'string') return author;
  if (author && typeof author === 'object') {
    return (author as Record<string, string>)['name'] ?? '';
  }
  return '';
}

function parseItem(item: Record<string, unknown>): ParsedArticle {
  return {
    title: typeof item['title'] === 'string' ? item['title'] : (item['title'] as Record<string, string>)?.['#text'] ?? '',
    url: isSafeUrl(extractLink(item['link'])),
    summary: extractSummary(item),
    author: extractAuthor(item),
    publishedAt: extractDate(item),
    thumbnailUrl: isSafeUrl(extractThumbnail(item)),
  };
}

export function parseRssFeed(xml: string): ParsedArticle[] {
  const parsed = parser.parse(xml);

  // RSS 2.0 format
  const rssItems = parsed?.rss?.channel?.item;
  if (rssItems) {
    const items = Array.isArray(rssItems) ? rssItems : [rssItems];
    return items.map(parseItem);
  }

  // Atom format
  const atomEntries = parsed?.feed?.entry;
  if (atomEntries) {
    const entries = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
    return entries.map(parseItem);
  }

  // RDF format (RSS 1.0)
  const rdfItems = parsed?.['rdf:RDF']?.item;
  if (rdfItems) {
    const items = Array.isArray(rdfItems) ? rdfItems : [rdfItems];
    return items.map(parseItem);
  }

  return [];
}

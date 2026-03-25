const DEFAULT_TTL = 300; // 5 minutes

export async function getCachedResponse<T>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  const cached = await kv.get(key, 'text');
  if (!cached) return null;
  try {
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function setCachedResponse<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
}

export async function invalidateCacheByPrefix(
  kv: KVNamespace,
  prefix: string
): Promise<void> {
  let cursor: string | undefined;
  do {
    const listed = await kv.list({ prefix, cursor });
    await Promise.all(listed.keys.map((k) => kv.delete(k.name)));
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
}

export function buildCacheKey(
  path: string,
  params: Record<string, string>
): string {
  const sortedEntries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  if (sortedEntries.length === 0) return path;

  const queryString = sortedEntries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  return `${path}?${queryString}`;
}

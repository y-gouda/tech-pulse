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

export async function invalidateCache(
  kv: KVNamespace,
  prefix: string
): Promise<void> {
  const listed = await kv.list({ prefix });
  const deletePromises = listed.keys.map((key) => kv.delete(key.name));
  await Promise.all(deletePromises);
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

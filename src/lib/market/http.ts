/**
 * 외부 API를 부르는 공통 계층.
 *
 * 처음 만들 때는 fetch를 그냥 불렀는데, 업비트가 잠깐 느려지면 화면 전체가
 * 멈췄다. 그래서 (1) 타임아웃, (2) 지수 백오프 재시도, (3) 호출 간격 제어,
 * (4) TTL 캐시를 이 파일 하나로 모았다. 실패했을 때 어디로 빠질지를
 * 호출부가 아니라 여기서 정한다.
 */

export class HttpError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "HttpError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 호스트별 최소 호출 간격을 강제한다 (업비트 공개 API는 초당 제한이 있다) */
const lastCallAt = new Map<string, number>();
const pending = new Map<string, Promise<void>>();

async function throttle(host: string, minIntervalMs: number): Promise<void> {
  const prev = pending.get(host) ?? Promise.resolve();
  const next = prev.then(async () => {
    const last = lastCallAt.get(host) ?? 0;
    const wait = last + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt.set(host, Date.now());
  });
  pending.set(host, next.catch(() => undefined));
  return next;
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  minIntervalMs?: number;
  headers?: Record<string, string>;
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 6000, retries = 2, minIntervalMs = 120, headers = {} } = opts;
  const host = new URL(url).host;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(host, minIntervalMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "isa-lab/0.1", ...headers },
        cache: "no-store",
      });
      if (!res.ok) {
        // 4xx는 다시 불러도 똑같다. 재시도는 429/5xx에만 의미가 있다.
        if (res.status < 500 && res.status !== 429) {
          throw new HttpError(`${host} ${res.status}`, res.status);
        }
        throw new HttpError(`${host} ${res.status} (retryable)`, res.status);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      const status = err instanceof HttpError ? err.status : undefined;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt === retries) break;
      await sleep(2 ** attempt * 300 + Math.random() * 200);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError(String(lastError));
}

/** 아주 단순한 TTL 캐시. 외부 API가 죽었을 때 만료된 값이라도 내주는 게 목적이다. */
interface CacheEntry<T> {
  value: T;
  at: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

export interface CachedResult<T> {
  value: T;
  stale: boolean;
}

export async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<CachedResult<T>> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return { value: hit.value, stale: false };
  try {
    const value = await loader();
    cache.set(key, { value, at: Date.now() });
    return { value, stale: false };
  } catch (err) {
    // 여기가 핵심. 새로 못 가져왔으면 옛날 값이라도 주고 stale로 표시한다.
    if (hit) return { value: hit.value, stale: true };
    throw err;
  }
}

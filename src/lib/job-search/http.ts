import "server-only";

import { jobSearchError } from "./errors";
import type { JobSource } from "./search";

// Requests to job sources (E14-1). Each source has a fixed host, so unlike
// fetching a posting (src/lib/posting-fetch.ts) there's no address to guard;
// requests are still limited in time and size.

export const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;

/** GETs JSON from a source (POSTs `body` as JSON when there is one), turning every failure into a JobSearchError; `timeoutMs` for a source that needs longer. */
export async function requestJson(
  source: JobSource,
  url: URL,
  {
    headers = {},
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
    body,
    logPath = url.pathname,
    maxBytes = MAX_BYTES,
  }: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
    body?: unknown;
    /** What the log says the request was to, for a source whose path holds its key. */
    logPath?: string;
    /** For a source whose answers are bigger, such as a whole company board. */
    maxBytes?: number;
  } = {},
): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
      headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
    });
  } catch (error) {
    const reason = timeout.aborted ? "timed out" : ((error as { cause?: { code?: string } }).cause?.code ?? "request failed");
    throw jobSearchError("unavailable", source, { detail: `${logPath}: ${reason}` });
  }

  const detail = `${logPath}: HTTP ${response.status}`;
  if (response.status === 401 || response.status === 403) throw jobSearchError("key", source, { detail });
  if (response.status === 429) throw jobSearchError("quota", source, { detail });
  if (!response.ok) throw jobSearchError(response.status >= 500 ? "unavailable" : "changed", source, { detail });

  const text = await readLimited(response, maxBytes);
  if (text === null) throw jobSearchError("changed", source, { detail: `${logPath}: answer over ${maxBytes} bytes` });
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw jobSearchError("changed", source, { detail: `${logPath}: not JSON` });
  }
}

/** The body as text, or null when it's bigger than `limit` bytes. */
async function readLimited(response: Response, limit: number): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

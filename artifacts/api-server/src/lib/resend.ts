import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export async function resendRequest<T>(
  path: string,
  init: { method: string; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const res = await connectors.proxy("resend", path, {
    method: init.method,
    ...(init.body !== undefined
      ? {
          body: JSON.stringify(init.body),
          headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        }
      : init.headers
        ? { headers: init.headers }
        : {}),
  });
  if (!res.ok) {
    throw new Error(`Resend ${init.method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

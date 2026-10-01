import "server-only";

/** Raw Telegram Bot API call with an explicit token (never logged). The one place that talks to api.telegram.org. */
export const tgCall = async <T = unknown>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const out = (await res.json().catch(() => null)) as { ok?: boolean; description?: string; result?: T } | null;
  if (!out?.ok) throw new Error(`telegram ${method}: ${out?.description ?? res.status}`);
  return out.result as T;
};

import "server-only";
import { supabaseAdmin } from "./supabase/admin";

/**
 * App error capture for the team console (/admin/health). Server-only; reportError NEVER throws, so it is safe in any catch block.
 * The workspace is `ctx.workspaceId` when the caller knows it, else resolved from `ctx.connectionId`.
 */
export type ErrorCtx = Record<string, unknown> & { workspaceId?: string | null; connectionId?: string | null };

const clip = (v: string, max: number) => (v.length > max ? `${v.slice(0, max)}…` : v);

export const reportError = async (scope: string, error: unknown, ctx: ErrorCtx = {}): Promise<void> => {
  try {
    const { workspaceId, connectionId, ...rest } = ctx;
    const db = supabaseAdmin();
    let ws = typeof workspaceId === "string" ? workspaceId : null;
    if (!ws && typeof connectionId === "string") {
      const { data } = await db.from("connections").select("workspace_id").eq("id", connectionId).maybeSingle<{ workspace_id: string }>();
      ws = data?.workspace_id ?? null;
    }
    const err = error instanceof Error ? error : null;
    await db.from("app_errors").insert({
      scope: clip(scope, 120),
      message: clip(err ? err.message : typeof error === "string" ? error : JSON.stringify(error) ?? String(error), 2000),
      stack: err?.stack ? clip(err.stack, 6000) : null,
      workspace_id: ws,
      ctx: { ...rest, ...(connectionId ? { connectionId } : {}) },
    });
  } catch {
    // Reporting must never break the request it is reporting on.
  }
};

/**
 * Wraps an API route handler at its export: `export const POST = withErrorReport("api.sepay", handler)`.
 * An exception is recorded and rethrown (the framework still answers 500); a handled 5xx response is recorded too.
 * Dynamic route params (e.g. connectionId) are passed along so the error carries its workspace.
 */
export const withErrorReport = <A extends Request, C extends { params?: Promise<Record<string, string>> }>(
  scope: string,
  handler: (request: A, context: C) => Promise<Response>,
) =>
  async (request: A, context: C): Promise<Response> => {
    const where = async (): Promise<ErrorCtx> => {
      const params = context?.params ? await context.params.catch(() => ({} as Record<string, string>)) : {};
      return { connectionId: params.connectionId ?? null, route: new URL(request.url).pathname, method: request.method, ...(params.op ? { op: params.op } : {}) };
    };
    let response: Response;
    try {
      response = await handler(request, context);
    } catch (e) {
      await reportError(scope, e, await where());
      throw e;
    }
    if (response.status >= 500) {
      const body = await response.clone().text().catch(() => "");
      await reportError(scope, new Error(`responded ${response.status}${body ? `: ${clip(body, 500)}` : ""}`), await where());
    }
    return response;
  };

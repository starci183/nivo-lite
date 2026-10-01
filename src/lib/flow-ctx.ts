import "server-only";
import { after } from "next/server";
import { getLocale } from "@/i18n/server";
import { getSession, type Session } from "./session";
import { supabaseServer } from "./supabase/server";
import { runQueued, type EngineCtx } from "./engine";

/** The engine context for the signed-in owner (session, RLS-scoped client, reader's locale). */
export const engineCtx = async (): Promise<EngineCtx & { session: Session }> => {
  const session = await getSession();
  return { session, db: await supabaseServer(), ws: session.workspace.id, actor: session.userName, locale: await getLocale() };
};

/**
 * Drain queued chain steps after the response is sent (Netlify time budget: one LLM call inline per request).
 * The context is captured before `after()`, so no request API is read inside the callback.
 */
export const drainAfter = (c: EngineCtx, limit = 2) => {
  const { db, ws, actor, locale } = c;
  try {
    after(async () => {
      try {
        await runQueued({ db, ws, actor, locale }, limit);
      } catch (e) {
        console.error("runQueued failed", e);
      }
    });
  } catch {
    // Outside a request scope (scripts): nothing to schedule.
  }
};

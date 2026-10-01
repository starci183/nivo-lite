"use server";

import { getT } from "@/i18n/server";
import { googleWizard } from "@/i18n/dict/googleWizard";
import { buildAuthUrl, safeReturnTo, signState } from "./google-sheets-core";
import { googleConfigured, googleStateKey } from "./google";
import { requireManager } from "./permissions";
import type { Outcome } from "./types";

/**
 * Start the Google OAuth consent: owner/manager only. Returns the Google URL the browser must go to; the signed state (workspace, user,
 * return path, 10 minutes) is verified by /api/connections/google/callback. `returnTo` must be a same-site path, else /connections.
 */
export const startGoogleConnect = async (returnTo: string): Promise<Outcome<{ url: string }>> => {
  const tr = await getT(googleWizard);
  try {
    const member = await requireManager();
    if (!googleConfigured()) return { ok: false, error: tr("errNotConfigured") };
    const state = signState(googleStateKey(), { workspaceId: member.workspaceId, userId: member.userId, returnTo: safeReturnTo(returnTo) });
    const url = buildAuthUrl(state);
    return url ? { ok: true, data: { url } } : { ok: false, error: tr("errNotConfigured") };
  } catch (e) {
    return { ok: false, error: e instanceof Error && !/CHANNEL_TOKEN_KEY/.test(e.message) ? e.message : tr("errStart") };
  }
};

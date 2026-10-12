"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n/core";
import { metaWizard as dict } from "@/i18n/dict/metaWizard";
import { encryptSecret, getConnection, publicSiteUrl, randomSecret, type Connection } from "./channels";
import { signState } from "./google-sheets-core";
import {
  authorizeUrl, ensureAppSubscriptions, loadMetaPage, loadMetaSecret, MetaGraphError, saveMetaSecret, subscribePage, subscriptionStatus,
  type MetaSubscriptionStatus,
} from "./meta";
import { INSTAGRAM_FIELDS, META_STATE_PURPOSE, PAGE_FIELDS, metaApp, metaStateKey, redirectUri, webhookUrl } from "./meta-core";
import { requireManager, requireOwner } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import type { Outcome } from "./types";

/**
 * The Meta (Facebook Pages + Instagram) wizard's server actions: start the login, show the Pages the person manages, subscribe the chosen
 * Page, and check what Meta really has (the webhook subscription status). Owner-only for changes (a manager may run the check), scoped to
 * the caller's workspace. The Page token is stored encrypted (AES-256-GCM, connection_secrets) and never returned to the browser.
 */
type Tr = Translate<(typeof dict)["en"]>;

class UserError extends Error {}
const userError = (message: string) => new UserError(message);

const friendly = (e: unknown, tr: Tr): string => {
  if (e instanceof UserError) return e.message;
  if (e instanceof MetaGraphError) {
    const f = e.failure;
    if (f === "token") return tr("errToken");
    if (f === "permission") return tr("errPermission");
    if (f === "rate_limited") return tr("errRate");
    if (e.status === 0) return tr("errNetwork");
  }
  const raw = e instanceof Error ? e.message : String(e);
  if (/fetch failed|network|timeout|ENOTFOUND|ECONN/i.test(raw)) return tr("errNetwork");
  console.error("meta action error", raw);
  return tr("errGeneric");
};

const run = async <T,>(fn: (tr: Tr) => Promise<T>): Promise<Outcome<T>> => {
  const tr = await getT(dict);
  try {
    return { ok: true, data: await fn(tr) };
  } catch (e) {
    return { ok: false, error: friendly(e, tr) };
  }
};

const now = () => new Date().toISOString();
const refresh = () => revalidatePath("/", "layout");

const own = async (workspaceId: string, id: string, tr: Tr): Promise<Connection> => {
  const c = await getConnection(workspaceId, id);
  if (!c || c.provider !== "meta") throw userError(tr("errNone"));
  return c;
};

export type MetaPageOption = { id: string; name: string; category: string; igId: string; igUsername: string };
export type MetaWizardConnection = {
  id: string; name: string; status: Connection["status"];
  /** Meta app keys are set on this NIVO (otherwise the login cannot start). */
  configured: boolean;
  /** The Pages the person manages, waiting for the choice (no tokens). */
  pages: ReadonlyArray<MetaPageOption>;
  /** The chosen Page, once picked. */
  pageId: string; pageName: string; igId: string; igUsername: string;
  firstEvent: Connection["firstEvent"]; agentIds: ReadonlyArray<string>;
};

const view = async (ws: string, id: string): Promise<MetaWizardConnection | null> => {
  const c = await getConnection(ws, id);
  if (!c) return null;
  const found = await loadMetaSecret(id);
  return {
    id: c.id, name: c.name, status: c.status, configured: metaApp() !== null,
    pages: (found?.secret.pages ?? []).map((p) => ({ id: p.id, name: p.name, category: p.category ?? "", igId: p.ig?.id ?? "", igUsername: p.ig?.username ?? "" })),
    pageId: c.meta.page_id ?? "", pageName: c.meta.page_name ?? "", igId: c.meta.ig_id ?? "", igUsername: c.meta.ig_username ?? "",
    firstEvent: c.firstEvent, agentIds: c.agentIds,
  };
};

/**
 * Wizard step 1: (re)start the Meta login. A PENDING connection is created on first use (so the choice and the agents have a place to live)
 * and the signed state (workspace, person, connection, 10 minutes) goes to Meta; /api/connections/meta/callback verifies it on the way back.
 */
export const startMetaConnect = async (input: { connectionId?: string }): Promise<Outcome<{ connectionId: string; url: string }>> =>
  run(async (tr) => {
    const member = await requireOwner();
    if (!metaApp()) throw userError(tr("errNotConfigured"));
    const db = supabaseAdmin();
    let id = input.connectionId ?? "";
    if (id) {
      await own(member.workspaceId, id, tr);
    } else {
      const { data: row, error } = await db.from("connections").insert({
        workspace_id: member.workspaceId, provider: "meta", name: "Facebook & Instagram", status: "pending", environment: "live", created_by: member.userId, public_meta: {},
      }).select("id").single();
      if (error || !row) throw new Error(error?.message ?? "connection not saved");
      id = row.id as string;
      const saved = await db.from("connection_secrets").insert({ connection_id: id, ciphertext: encryptSecret("{}"), webhook_secret: randomSecret() });
      if (saved.error) {
        await db.from("connections").delete().eq("id", id);
        throw new Error(saved.error.message);
      }
    }
    const state = signState(metaStateKey(process.env.CHANNEL_TOKEN_KEY), {
      workspaceId: member.workspaceId, userId: member.userId, returnTo: `/connections?connect=meta&id=${id}`, purpose: META_STATE_PURPOSE,
    });
    const url = authorizeUrl(state);
    if (!url) throw userError(tr("errNotConfigured"));
    refresh();
    return { connectionId: id, url };
  });

/** Continue an unfinished (or broken) connection: the Pages waiting for the choice, or the chosen one. Tokens are never returned. */
export const resumeMeta = async (connectionId: string): Promise<Outcome<MetaWizardConnection>> =>
  run(async (tr) => {
    const member = await requireOwner();
    await own(member.workspaceId, connectionId, tr);
    return (await view(member.workspaceId, connectionId)) as MetaWizardConnection;
  });

/**
 * Wizard step 2: the owner picked a Page (and with it the Instagram account linked to it). The Page is subscribed to the app's webhook fields
 * (messages, messaging_postbacks, feed, leadgen), the app-level webhook is pointed at NIVO when the site is public, only that Page's token
 * is kept, and the connection shows the Page name and the Instagram handle. One Page / Instagram account belongs to one live connection.
 */
export const chooseMetaPage = async (connectionId: string, pageId: string): Promise<Outcome<MetaWizardConnection>> =>
  run(async (tr) => {
    const member = await requireOwner();
    const ws = member.workspaceId;
    await own(ws, connectionId, tr);
    const found = await loadMetaSecret(connectionId);
    const choice = found?.secret.pages?.find((p) => p.id === pageId);
    if (!choice) throw userError(tr("errPageGone"));
    const db = supabaseAdmin();

    const taken = async (key: "page_id" | "ig_id", value: string): Promise<boolean> => {
      const { data } = await db.from("connections").select("id").eq("provider", "meta").neq("status", "disconnected").neq("id", connectionId).eq(`public_meta->>${key}`, value).limit(1);
      return Boolean(data?.length);
    };
    if ((await taken("page_id", choice.id)) || (choice.ig && (await taken("ig_id", choice.ig.id)))) throw userError(tr("errPageInUse"));

    await subscribePage(choice.id, choice.token);
    await ensureAppSubscriptions().catch((e) => console.error("meta app subscription failed", e instanceof Error ? e.message : e));

    await saveMetaSecret(connectionId, { pageId: choice.id, pageToken: choice.token });
    const { error } = await db.from("connections").update({
      name: choice.name.slice(0, 60), status: "connected", last_error: null, updated_at: now(),
      public_meta: { page_id: choice.id, page_name: choice.name, ...(choice.category ? { category: choice.category } : {}), ...(choice.ig ? { ig_id: choice.ig.id, ig_username: choice.ig.username ?? "" } : {}) },
    }).eq("id", connectionId);
    if (error) throw new Error(error.message);
    refresh();
    return (await view(ws, connectionId)) as MetaWizardConnection;
  });

export type AppObjectCheck = { readonly callbackUrl: string; readonly fields: ReadonlyArray<string>; readonly missing: ReadonlyArray<string>; readonly urlMatches: boolean };
export type MetaCheck = {
  /** Everything Meta needs to deliver is in place. */
  ok: boolean;
  tokenOk: boolean;
  pageId: string; pageName: string; igUsername: string;
  page: { subscribed: boolean; fields: ReadonlyArray<string>; missing: ReadonlyArray<string> };
  /** The app-level webhook per object (null = Meta would not tell: set in the Meta dashboard). */
  appPage: AppObjectCheck | null;
  appInstagram: AppObjectCheck | null;
  appKnown: boolean;
  wantPage: ReadonlyArray<string>;
  wantInstagram: ReadonlyArray<string>;
  webhookUrl: string;
  redirectUri: string;
  /** The site is not public https: Meta cannot reach the webhook from here. */
  localOnly: boolean;
  verifyTokenSet: boolean;
  /** `repair` ran the subscriptions again. */
  repaired: boolean;
};

/**
 * The test step: ask Meta what it has. The Page subscription (Page token) and the app webhook subscription (app token) are read from Graph,
 * so the owner sees "subscribed to messages, feed ..." or exactly what is missing. With `repair` the subscriptions are made again first.
 */
export const testMeta = async (connectionId: string, opts: { repair?: boolean } = {}): Promise<Outcome<MetaCheck>> =>
  run(async (tr) => {
    const member = await requireManager();
    const c = await own(member.workspaceId, connectionId, tr);
    if (c.status === "disconnected") throw userError(tr("errNone"));
    const page = await loadMetaPage(c.id);
    if (!page) throw userError(tr("errNoPage"));
    const db = supabaseAdmin();
    let repaired = false;
    const base = {
      pageId: page.pageId, pageName: page.pageName, igUsername: page.igUsername ?? "", wantPage: PAGE_FIELDS, wantInstagram: INSTAGRAM_FIELDS,
      webhookUrl: webhookUrl(), redirectUri: redirectUri(), localOnly: publicSiteUrl() === null, verifyTokenSet: Boolean((process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim()),
    };
    try {
      if (opts.repair) {
        await subscribePage(page.pageId, page.pageToken);
        await ensureAppSubscriptions().catch((e) => console.error("meta app subscription failed", e instanceof Error ? e.message : e));
        repaired = true;
      }
      const s: MetaSubscriptionStatus = await subscriptionStatus(page);
      const igWanted = Boolean(page.igId);
      const appOk = s.app === null || (s.app.page !== null && s.app.page.urlMatches && s.app.page.missing.length === 0 && (!igWanted || (s.app.instagram !== null && s.app.instagram.urlMatches && s.app.instagram.missing.length === 0)));
      const ok = s.page.subscribed && s.page.missing.length === 0 && appOk;
      if (c.status === "error") await db.from("connections").update({ status: "connected", last_error: null, updated_at: now() }).eq("id", c.id);
      refresh();
      return { ...base, ok, tokenOk: true, page: s.page, appPage: s.app?.page ?? null, appInstagram: s.app?.instagram ?? null, appKnown: s.app !== null, repaired };
    } catch (e) {
      // A refused token is the one failure the owner must act on: mark the connection so the list says "connect again".
      if (e instanceof MetaGraphError && e.failure === "token") {
        await db.from("connections").update({ status: "error", last_error: tr("errToken"), updated_at: now() }).eq("id", c.id);
        refresh();
        return { ...base, ok: false, tokenOk: false, page: { subscribed: false, fields: [], missing: PAGE_FIELDS }, appPage: null, appInstagram: null, appKnown: false, repaired };
      }
      throw e;
    }
  });

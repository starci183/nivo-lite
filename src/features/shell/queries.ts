import "server-only";
import { cache } from "react";
import { getT } from "@/i18n/server";
import { shell } from "@/i18n/dict/shell";
import { getSession } from "@/lib/session";
import type { ShellMember } from "./member-context";
import { drainAfter, engineCtx } from "@/lib/flow-ctx";
import { FOUNDING_OFFER } from "@/lib/promo";
import { supabaseServer } from "@/lib/supabase/server";

/** One execution waiting for a human decision, as the notification list draws it. */
export type ShellPending = { readonly id: string; readonly leadName: string; readonly summary: string; readonly href: string };

/** One installed agent, as the sidebar and New menu draw it. */
export type ShellAgent = { readonly id: string; readonly name: string; readonly module: string; readonly status: "active" | "paused" };

/** Real counts and lists the console chrome needs. */
export type ShellData = {
  readonly pending: ReadonlyArray<ShellPending>;
  /** Decisions waiting on a person: `getGovernance().pendingDecisions` (approvals + exceptions, counted once). */
  readonly pendingCount: number;
  readonly leadCount: number;
  readonly openResponsibilityCount: number;
  readonly agents: ReadonlyArray<ShellAgent>;
  /** The signed-in person in this workspace: drives role-aware navigation and menus. */
  readonly member: ShellMember;
  /** Every workspace the person is an active member of (for the switcher). */
  readonly workspaces: ReadonlyArray<{ readonly id: string; readonly name: string; readonly role: "owner" | "manager" | "staff" }>;
  readonly currentWorkspaceId: string;
};

type ShellRaw = {
  lead_count: number;
  open_responsibility_count: number;
  agents: Array<ShellAgent>;
  has_chatbot: boolean;
  is_founding_member: boolean;
  pending: Array<{ id: string; draft: string; next_action: string | null; lead_id: string | null; contact_name: string | null }>;
  exceptions: Array<{ id: string; lead_id: string | null; contact_name: string | null; summary: string | null; error: string | null }>;
  pending_decisions: number;
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Everything the frame reads from the database, in ONE request (SQL function `shell_data`, under the caller's RLS). Once per request. */
const getShellRaw = cache(async (): Promise<ShellRaw> => {
  const session = await getSession();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("shell_data", {
    ws: session.workspace.id, founding_from: FOUNDING_OFFER.startsAt, founding_to: FOUNDING_OFFER.endsAt,
  });
  if (error) throw new Error(error.message);
  // Chain steps queued by the flow engine are drained after the response, once per request (the Office, dashboard and frame all used to ask).
  drainAfter(await engineCtx());
  return data as ShellRaw;
});

/** Promo flags the frame needs (sidebar offer): from the same single request as the shell data. */
export const getShellPromoFlags = async (): Promise<{ hasChatbot: boolean; isFoundingMember: boolean }> => {
  const raw = await getShellRaw();
  return { hasChatbot: raw.has_chatbot, isFoundingMember: raw.is_founding_member };
};

/** Counts, pending approvals and agents for the signed-in workspace. */
export const getShellData = async (): Promise<ShellData> => {
  const [t, session, raw] = await Promise.all([getT(shell), getSession(), getShellRaw()]);
  const pending: Array<ShellPending> = raw.pending.map((e) => ({
    id: e.id,
    leadName: e.contact_name ?? t("unknownLead"),
    summary: clip(e.next_action || e.draft, 60),
    href: e.lead_id ? `/leads/${e.lead_id}` : "/leads",
  }));
  // Exceptions with no approval card of their own (an approval card is already in the list above).
  const exceptionPending: Array<ShellPending> = raw.exceptions.map((item) => ({
    id: `wi-${item.id}`,
    leadName: item.contact_name ?? t("unknownLead"),
    summary: clip(item.summary || item.error || "", 60),
    href: "/chat",
  }));
  const allPending = [...pending, ...exceptionPending];
  return {
    pending: allPending,
    pendingCount: raw.pending_decisions,
    leadCount: raw.lead_count,
    openResponsibilityCount: raw.open_responsibility_count,
    workspaces: session.workspaces,
    currentWorkspaceId: session.workspace.id,
    member: { userId: session.member.userId, name: session.member.displayName, role: session.member.role, staffId: session.member.staffId },
    agents: raw.agents,
  };
};

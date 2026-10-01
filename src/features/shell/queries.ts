import "server-only";
import { getT } from "@/i18n/server";
import { shell } from "@/i18n/dict/shell";
import { getSession } from "@/lib/session";
import type { ShellMember } from "./member-context";
import { getGovernance, listExceptions } from "@/lib/flow-queries";
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

type ExecRow = { id: string; kind: string; draft: string; responsibility_id: string };
type RespRow = { id: string; lead_id: string; next_action: string };
type LeadRow = { id: string; contact_name: string; company: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Counts, pending approvals and agents for the signed-in workspace. */
export const getShellData = async (): Promise<ShellData> => {
  const t = await getT(shell);
  const session = await getSession();
  const supabase = await supabaseServer();
  const wid = session.workspace.id;
  const [execs, leads, open, agents, mine] = await Promise.all([
    supabase.from("executions").select("id, kind, draft, responsibility_id").eq("workspace_id", wid).eq("status", "pending_approval").order("created_at", { ascending: false }),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wid),
    supabase.from("responsibilities").select("id", { count: "exact", head: true }).eq("workspace_id", wid).neq("status", "done"),
    supabase.from("agents").select("id, name, module, status").eq("workspace_id", wid).order("created_at"),
    supabase.from("workspace_members").select("workspace_id, role, workspaces(name)").eq("user_id", session.userId).eq("status", "active").order("created_at"),
  ]);
  type MineRow = { workspace_id: string; role: "owner" | "manager" | "staff"; workspaces: { name: string } | Array<{ name: string }> | null };
  const workspaces = ((mine.data ?? []) as unknown as Array<MineRow>).map((m) => ({
    id: m.workspace_id, role: m.role, name: (Array.isArray(m.workspaces) ? m.workspaces[0]?.name : m.workspaces?.name) ?? session.workspace.name,
  }));
  const [governance, exceptions] = await Promise.all([
    getGovernance().catch(() => null),
    listExceptions().catch(() => []),
  ]);
  const execRows = (execs.data ?? []) as Array<ExecRow>;
  let pending: Array<ShellPending> = [];
  if (execRows.length > 0) {
    const { data: respData } = await supabase.from("responsibilities").select("id, lead_id, next_action").in("id", [...new Set(execRows.map((e) => e.responsibility_id))]);
    const resps = (respData ?? []) as Array<RespRow>;
    const { data: leadData } = await supabase.from("leads").select("id, contact_name, company").in("id", [...new Set(resps.map((r) => r.lead_id))]);
    const leadRows = (leadData ?? []) as Array<LeadRow>;
    pending = execRows.map((e) => {
      const resp = resps.find((r) => r.id === e.responsibility_id);
      const lead = leadRows.find((l) => l.id === resp?.lead_id);
      return {
        id: e.id,
        leadName: lead ? lead.contact_name : t("unknownLead"),
        summary: clip(resp?.next_action || e.draft, 60),
        href: lead ? `/leads/${lead.id}` : "/leads",
      };
    });
  }
  // Exceptions with no approval card of their own (an approval card is already in the list above).
  const exceptionPending: Array<ShellPending> = exceptions
    .filter((item) => !item.hasApprovalCard)
    .map((item) => ({
      id: `wi-${item.id}`,
      leadName: item.lead?.contact_name ?? t("unknownLead"),
      summary: clip(item.proposal.summary || item.error || "", 60),
      href: "/chat",
    }));
  const allPending = [...pending, ...exceptionPending];
  return {
    pending: allPending,
    pendingCount: governance?.pendingDecisions ?? allPending.length,
    leadCount: leads.count ?? 0,
    openResponsibilityCount: open.count ?? 0,
    workspaces,
    currentWorkspaceId: wid,
    member: { userId: session.member.userId, name: session.member.displayName, role: session.member.role, staffId: session.member.staffId },
    agents: ((agents.data ?? []) as Array<ShellAgent>).map((a) => ({ id: a.id, name: a.name, module: a.module, status: a.status })),
  };
};

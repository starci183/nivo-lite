import "server-only";
import { cache } from "react";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { Agent, EventRow, Execution, Lead, LeadDetail, Message, Responsibility, ResponsibilityWithLead } from "./types";

const ctx = async () => ({ session: await getSession(), supabase: await supabaseServer() });

export const listAgents = cache(async (): Promise<Agent[]> => {
  const { session, supabase } = await ctx();
  const { data } = await supabase.from("agents").select("*").eq("workspace_id", session.workspace.id).order("created_at");
  return withInstanceNames((data ?? []) as Agent[]);
});

/**
 * Agents with the name of the instance each one drives, for a multi-instance type (several Chatbots, one per branch or Fanpage): lists,
 * Office members and mentions can then tell "Chatbot – Chi nhánh Q1" from "Chatbot – Chi nhánh Q7". Never throws (names are a courtesy).
 */
export const withInstanceNames = async (agents: ReadonlyArray<Agent>): Promise<Array<Agent>> => {
  if (agents.length === 0) return [];
  try {
    const { supabase } = await ctx();
    const { data } = await supabase.from("module_installations").select("agent_id, name, is_multi").in("agent_id", agents.map((a) => a.id));
    const byAgent = new Map(((data ?? []) as Array<{ agent_id: string; name: string; is_multi: boolean }>).filter((r) => r.is_multi).map((r) => [r.agent_id, r.name]));
    return agents.map((a) => ({ ...a, instance_name: byAgent.get(a.id) ?? null }));
  } catch {
    return [...agents];
  }
};

export const getAgent = async (id: string): Promise<Agent | null> => {
  const { supabase } = await ctx();
  const { data } = await supabase.from("agents").select("*").eq("id", id).maybeSingle<Agent>();
  return data;
};

export type LeadRow = Lead & { owner_name: string | null; next_action: string | null };

export const listLeads = cache(async (): Promise<LeadRow[]> => {
  const { session, supabase } = await ctx();
  const [{ data: leads }, { data: resp }] = await Promise.all([
    supabase.from("leads").select("*").eq("workspace_id", session.workspace.id).order("created_at", { ascending: false }),
    supabase.from("responsibilities").select("lead_id, owner_name, next_action, status").eq("workspace_id", session.workspace.id).neq("status", "done"),
  ]);
  return leadRowsFrom(leads ?? [], resp ?? []);
});

/** Leads with the owner and next action of their open responsibility, from rows already read. */
export const leadRowsFrom = (leads: ReadonlyArray<unknown>, resp: ReadonlyArray<{ lead_id: string; owner_name: string | null; next_action: string | null }>): LeadRow[] =>
  (leads as Lead[]).map((l) => {
    const r = resp.find((x) => x.lead_id === l.id);
    return { ...l, owner_name: r?.owner_name ?? null, next_action: r?.next_action ?? null };
  });

export const listResponsibilities = cache(async (): Promise<ResponsibilityWithLead[]> => {
  const { session, supabase } = await ctx();
  const { data } = await supabase
    .from("responsibilities")
    .select("*, lead:leads(id, contact_name, company, stage)")
    .eq("workspace_id", session.workspace.id)
    .order("due_at", { ascending: true, nullsFirst: false });
  return (data ?? []) as ResponsibilityWithLead[];
});

export const getLeadDetail = async (leadId: string): Promise<LeadDetail | null> => {
  const { session, supabase } = await ctx();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle<Lead>();
  if (!lead) return null;
  const [r, ev, a] = await Promise.all([
    supabase.from("responsibilities").select("*").eq("lead_id", leadId).order("created_at"),
    supabase.from("events").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
    supabase.from("agents").select("*").eq("workspace_id", session.workspace.id).order("created_at"),
  ]);
  const responsibilities = (r.data ?? []) as Responsibility[];
  const ids = responsibilities.map((x) => x.id);
  const e = ids.length
    ? await supabase.from("executions").select("*").in("responsibility_id", ids).order("created_at")
    : { data: [] };
  return {
    lead,
    responsibilities,
    executions: (e.data ?? []) as Execution[],
    events: (ev.data ?? []) as EventRow[],
    agents: (a.data ?? []) as Agent[],
  };
};

export const listMessages = cache(async (limit = 100): Promise<Message[]> => {
  const { session, supabase } = await ctx();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Message[]).reverse();
});

export const listRecentEvents = cache(async (limit = 20): Promise<EventRow[]> => {
  const { session, supabase } = await ctx();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as EventRow[];
});

import "server-only";
import { cache } from "react";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { Agent, EventRow, Execution, Lead, LeadDetail, Message, Responsibility, ResponsibilityWithLead } from "./types";

const ctx = async () => ({ session: await getSession(), supabase: await supabaseServer() });

export const listAgents = cache(async (): Promise<Agent[]> => {
  const { session, supabase } = await ctx();
  const { data } = await supabase.from("agents").select("*").eq("workspace_id", session.workspace.id).order("created_at");
  return (data ?? []) as Agent[];
});

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
  return ((leads ?? []) as Lead[]).map((l) => {
    const r = resp?.find((x) => x.lead_id === l.id);
    return { ...l, owner_name: r?.owner_name ?? null, next_action: r?.next_action ?? null };
  });
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as ai from "./deepseek";
import { moduleSpec } from "./modules";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { getT } from "@/i18n/server";
import { system } from "@/i18n/dict/system";
import { governance } from "@/i18n/dict/governance";
import { translator } from "@/i18n/core";
import { ingest } from "./core";
import { loadAuthority, resumeWork, runWork, type EngineCtx } from "./engine";
import { drainAfter, engineCtx } from "./flow-ctx";
import { customerTurn } from "./customer-turn";
import { ownerChatForOffice } from "./flow-actions";
import { insertHumanMessage, relayStaffAnswer, staffMember } from "./staff-relay";
import type { WorkItem } from "./flow-types";
import type { Agent, AgentConversation, AgentMessage, Execution, Lead, Message, ModuleKey, Outcome, Responsibility } from "./types";

/* ------------------------------------------------------------------ helpers */

const ctx = async () => ({ session: await getSession(), supabase: await supabaseServer() });

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("Not found");
  return res.data;
};

const refreshAll = () => {
  revalidatePath("/", "layout");
};

type Db = Awaited<ReturnType<typeof supabaseServer>>;

const logEvent = (supabase: Db, workspace_id: string, lead_id: string | null, kind: string, actor: string, summary: string, evidence: string | null = null) =>
  supabase.from("events").insert({ workspace_id, lead_id, kind, actor, summary, evidence });

const postSystem = (supabase: Db, workspace_id: string, body: string, lead_id: string | null = null) =>
  supabase.from("messages").insert({ workspace_id, author_kind: "system", author_name: "NIVO", body, lead_id });

const leadInput = (l: Lead): ai.LeadInput => ({ contact_name: l.contact_name, company: l.company, channel: l.channel, need: l.need });
const gov = (c: EngineCtx) => translator(governance, c.locale) as (k: string) => string;
const agentInput = (a: Agent): ai.AgentInput => ({
  name: a.name, handle: a.handle, role: a.role, instructions: a.instructions, knowledge: a.knowledge, approval_rule: a.approval_rule,
});

/* ------------------------------------------------------------------ auth */

export const signOut = async () => {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
};

/* ------------------------------------------------------------------ agents (modules) */

export type AgentSetupInput = {
  name: string; handle: string; role: string; instructions: string; knowledge: string; greeting: string; approval_rule: string;
};

/** Install a module as a new agent. Only available modules (Chatbot in this build) can be installed. */
export const installAgent = async (module: ModuleKey, input: Partial<AgentSetupInput> = {}): Promise<Outcome<Agent>> =>
  run(async () => {
    const spec = moduleSpec(module);
    if (!spec.available) throw new Error(`${spec.name} is already included with this workspace.`);
    const { session, supabase } = await ctx();
    const handle = (input.handle || spec.key).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 16) || spec.key;
    const agent = must(
      await supabase.from("agents").insert({
        workspace_id: session.workspace.id, module,
        name: input.name || `${spec.name} Agent`, handle, role: input.role || spec.defaultRole,
        instructions: input.instructions || spec.defaultInstructions, knowledge: input.knowledge ?? "", greeting: input.greeting ?? "",
        ...(input.approval_rule ? { approval_rule: input.approval_rule } : {}),
      }).select().single<Agent>(),
    );
    await postSystem(supabase, session.workspace.id, (await getT(system))("bought", { user: session.userName, module: spec.name, agent: agent.name, handle: agent.handle }));
    await logEvent(supabase, session.workspace.id, null, "module.purchased", session.userName, (await getT(system))("boughtEvent", { module: spec.name, agent: agent.name }));
    refreshAll();
    return agent;
  });

/** AI helper for the setup form: turn a plain description into a suggested agent setup. */
export const suggestAgentSetup = async (description: string): Promise<Outcome<{ name: string; handle: string; role: string; instructions: string }>> =>
  run(() => ai.designModule(description));

export const updateAgent = async (agentId: string, input: Partial<AgentSetupInput> & { status?: "active" | "paused" }): Promise<Outcome<Agent>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const agent = must(await supabase.from("agents").update(input).eq("id", agentId).select().single<Agent>());
    await logEvent(supabase, session.workspace.id, null, "agent.updated", session.userName, (await getT(system))("updatedSetup", { agent: agent.name }));
    refreshAll();
    return agent;
  });

/* ------------------------------------------------------------------ agent chat (1:1) */

export const listConversations = async (agentId: string): Promise<AgentConversation[]> => {
  const { supabase } = await ctx();
  const { data } = await supabase.from("agent_conversations").select("*").eq("agent_id", agentId).order("created_at", { ascending: false });
  return (data ?? []) as AgentConversation[];
};

export const listAgentMessages = async (conversationId: string): Promise<AgentMessage[]> => {
  const { supabase } = await ctx();
  const { data } = await supabase.from("agent_messages").select("*").eq("conversation_id", conversationId).order("created_at");
  return (data ?? []) as AgentMessage[];
};

/** Open a new 1:1 conversation: "test" (owner tries the agent) or "customer" (simulated customer channel). */
export const startConversation = async (agentId: string, kind: "test" | "customer", visitorName?: string): Promise<Outcome<AgentConversation>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const agent = must(await supabase.from("agents").select("*").eq("id", agentId).single<Agent>());
    const conv = must(
      await supabase.from("agent_conversations").insert({
        workspace_id: session.workspace.id, agent_id: agentId, kind, visitor_name: visitorName ?? (kind === "customer" ? "Website visitor" : session.userName),
      }).select().single<AgentConversation>(),
    );
    if (agent.greeting) {
      await supabase.from("agent_messages").insert({ workspace_id: session.workspace.id, conversation_id: conv.id, role: "agent", body: agent.greeting });
    }
    return conv;
  });

/**
 * Send a message in a 1:1 conversation and get the agent's reply.
 * Customer (website) conversation: the chatbot replies within the owner's authority; once the customer has shared enough,
 * NIVO hands the lead to Sales AI through the gate (chatbot.handoff_lead, origin live). A question that needs a commitment
 * becomes a waiting chatbot.reply_customer item carrying the proposed answer. While a person has taken over the
 * conversation the AI stays quiet and `reply` is the customer's own stored message (role "user").
 */
export const sendAgentMessage = async (
  conversationId: string,
  body: string,
): Promise<Outcome<{ reply: AgentMessage; capturedLeadId: string | null }>> =>
  run(async () => {
    const c = await engineCtx();
    const { db: supabase, ws } = c;
    const conv = must(await supabase.from("agent_conversations").select("*").eq("id", conversationId).single<AgentConversation>());
    const agent = must(await supabase.from("agents").select("*").eq("id", conv.agent_id).single<Agent>());
    if (conv.kind === "customer") {
      const turn = await customerTurn(c, conv, agent, body);
      if (turn.changed) refreshAll();
      return { reply: turn.reply, capturedLeadId: turn.capturedLeadId };
    }
    must(await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "user", body }).select().single<AgentMessage>());
    const history = ((await supabase.from("agent_messages").select("*").eq("conversation_id", conv.id).order("created_at")).data ?? []) as AgentMessage[];
    const turns: ai.ChatTurn[] = history.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "user" ? "user" : "agent", body: m.body }));
    const text = await ai.testChat(agentInput(agent), turns, ai.authorityBrief(await loadAuthority(c)));
    const reply = must(await supabase.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "agent", body: text }).select().single<AgentMessage>());
    return { reply, capturedLeadId: null };
  });

/* ------------------------------------------------------------------ leads & the journey */

/** Manual lead capture from the Leads screen: recorded as a manual input and handed to Sales AI through the gate. */
export const createLead = async (input: ai.LeadInput & { phone?: string; email?: string }): Promise<Outcome<{ leadId: string }>> =>
  run(async () => {
    const c = await engineCtx();
    const t = translator(system, c.locale);
    const contact = input.phone?.trim() || input.email?.trim() || null;
    const { event } = await ingest(c.db, c.ws, {
      channel: "manual", kind: "lead", origin: "live", sender_name: input.contact_name, sender_contact: contact,
      body: input.need, amount_vnd: null, external_ref: `${input.channel}:${input.company}`,
    }, (n) => t("duplicateBlocked", { n }));
    const item = await runWork(c, {
      action: "handoff_lead", subject_type: "inbound", subject_id: event.id, inbound_event_id: event.id, origin: "live",
      dedupeKey: `handoff_lead:inbound:${event.id}`,
      seed: { fields: { contact_name: input.contact_name, company: input.company, need: input.need, contact, channel_label: input.channel } },
    });
    const leadId = item.lead_id ?? event.lead_id;
    if (!leadId) throw new Error(item.status === "waiting_decision" ? t("stillMissing", { fields: item.missing_fields.map((f) => gov(c)(`field_${f}`)).join(", ") }) : item.error ?? "Could not create the lead");
    drainAfter(c);
    refreshAll();
    return { leadId };
  });

const buildContext = async (supabase: Db, ws: string, lead: Lead, history: string[]) => {
  const summary = await ai.summarizeContext(leadInput(lead), history);
  await supabase.from("leads").update({ context_summary: summary }).eq("id", lead.id);
  await logEvent(supabase, ws, lead.id, "context.summarised", "NIVO AI", (await getT(system))("contextCreated"), summary);
  return summary;
};

/** Re-generate the context brief of a lead. */
export const refreshContext = async (leadId: string): Promise<Outcome<string>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const lead = must(await supabase.from("leads").select("*").eq("id", leadId).single<Lead>());
    const events = ((await supabase.from("events").select("summary").eq("lead_id", leadId)).data ?? []).map((e) => e.summary as string);
    const summary = await buildContext(supabase, session.workspace.id, lead, events);
    refreshAll();
    return summary;
  });

const proposeOwner = async (supabase: Db, ws: string, ownerName: string, leadId: string) => {
  const lead = must(await supabase.from("leads").select("*").eq("id", leadId).single<Lead>());
  const all = ((await supabase.from("agents").select("*").eq("workspace_id", ws).eq("status", "active")).data ?? []) as Agent[];
  // Leads are owned by Sales (or a human); the Chatbot captures, Accounting only receives won deals.
  const agents = all.filter((a) => a.module === "sales").length ? all.filter((a) => a.module === "sales") : all;
  const p = await ai.proposeResponsibility(leadInput(lead), lead.context_summary ?? "", agents.map(agentInput), ownerName);
  const agent = p.owner_kind === "agent" ? agents.find((a) => a.handle === p.owner_handle) ?? agents[0] : undefined;
  const resp = must(
    await supabase.from("responsibilities").insert({
      workspace_id: ws, lead_id: lead.id, title: p.title,
      owner_kind: agent ? "agent" : "human", owner_agent_id: agent?.id ?? null, owner_name: agent?.name ?? ownerName,
      next_action: p.next_action, due_at: new Date(Date.now() + Math.max(0, p.due_in_days) * 86_400_000).toISOString(),
    }).select().single<Responsibility>(),
  );
  await logEvent(supabase, ws, lead.id, "responsibility.assigned", "NIVO AI",
    (await getT(system))("ownerNext", { owner: resp.owner_name, next: resp.next_action }), p.rationale);
  await postSystem(supabase, ws, (await getT(system))("ownerSet", { name: lead.contact_name, owner: agent ? `@${agent.handle}` : resp.owner_name, next: resp.next_action }), lead.id);
  return resp;
};

/** Ask AI to propose a responsibility (owner + next action) for a lead that has none. */
export const suggestResponsibility = async (leadId: string): Promise<Outcome<Responsibility>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const r = await proposeOwner(supabase, session.workspace.id, session.userName, leadId);
    refreshAll();
    return r;
  });

/** Human edits the owner / next action / due date (assignment). owner = "human" or an agent id. */
export const assignResponsibility = async (
  responsibilityId: string, input: { owner: "human" | string; next_action: string; due_at: string | null; title?: string },
): Promise<Outcome<Responsibility>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const agent = input.owner === "human" ? null : must(await supabase.from("agents").select("*").eq("id", input.owner).single<Agent>());
    const r = must(
      await supabase.from("responsibilities").update({
        owner_kind: agent ? "agent" : "human", owner_agent_id: agent?.id ?? null, owner_name: agent?.name ?? session.userName,
        next_action: input.next_action, due_at: input.due_at, ...(input.title ? { title: input.title } : {}),
      }).eq("id", responsibilityId).select().single<Responsibility>(),
    );
    await logEvent(supabase, session.workspace.id, r.lead_id, "responsibility.assigned", session.userName,
      (await getT(system))("ownerNext", { owner: r.owner_name, next: r.next_action }));
    refreshAll();
    return r;
  });

/**
 * The owning agent drafts the message that performs the next action (sales.send_follow_up through the gate).
 * Inside the granted authority it is sent by itself and the execution is recorded as approved by NIVO;
 * otherwise it waits for approval as before (execution pending_approval, linked to the work item).
 */
export const draftExecution = async (responsibilityId: string): Promise<Outcome<Execution>> =>
  run(async () => {
    const c = await engineCtx();
    const r = must(await c.db.from("responsibilities").select("*").eq("id", responsibilityId).single<Responsibility>());
    const lead = must(await c.db.from("leads").select("*").eq("id", r.lead_id).single<Lead>());
    const item = await runWork(c, {
      action: "send_follow_up", subject_type: "lead", subject_id: lead.id, lead_id: lead.id, origin: lead.origin ?? "live",
      dedupeKey: `send_follow_up:resp:${r.id}:${Date.now()}`, noChain: true, seed: { fields: { responsibility_id: r.id } },
    });
    if (item.status === "failed") throw new Error(item.error ?? "Could not draft");
    const exId = item.execution_id ?? ((await c.db.from("work_items").select("execution_id").eq("id", item.id).single()).data?.execution_id as string | null);
    if (!exId) {
      // Waiting for missing data (no contact yet): the Office exception card asks for it.
      throw new Error(translator(system, c.locale)("stillMissing", { fields: item.missing_fields.map((f) => gov(c)(`field_${f}`)).join(", ") }));
    }
    refreshAll();
    return must(await c.db.from("executions").select("*").eq("id", exId).single<Execution>());
  });

/**
 * Owner approves (optionally edits) or rejects a draft. When the draft belongs to a work item, the engine resumes
 * that same work (guarded, so a double click is safe); otherwise the legacy approval path records it.
 */
export const decideExecution = async (executionId: string, decision: "approved" | "rejected", editedDraft?: string): Promise<Outcome<Execution>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const ws = session.workspace.id;
    const current = must(await supabase.from("executions").select("*").eq("id", executionId).single<Execution>());
    if (current.work_item_id) {
      const c = await engineCtx();
      if (current.status !== "pending_approval") throw new Error(translator(system, c.locale)("alreadyDecided"));
      await resumeWork(c, current.work_item_id, decision, editedDraft ? { draft: editedDraft } : {}, { name: session.userName, kind: "owner" });
      // The engine records the execution as approved when it performs; a rejection is recorded here.
      if (decision === "rejected") {
        await supabase.from("executions").update({ status: "rejected", decided_by: session.userName, decided_at: new Date().toISOString(), ...(editedDraft ? { draft: editedDraft } : {}) }).eq("id", executionId);
      }
      drainAfter(c);
      refreshAll();
      return must(await supabase.from("executions").select("*").eq("id", executionId).single<Execution>());
    }
    const ex = must(
      await supabase.from("executions").update({
        status: decision, decided_by: session.userName, decided_at: new Date().toISOString(), ...(editedDraft ? { draft: editedDraft } : {}),
      }).eq("id", executionId).eq("status", "pending_approval").select().single<Execution>(),
    );
    const r = must(await supabase.from("responsibilities").select("*").eq("id", ex.responsibility_id).single<Responsibility>());
    const lead = must(await supabase.from("leads").select("*").eq("id", r.lead_id).single<Lead>());
    if (decision === "approved") {
      await supabase.from("responsibilities").update({ status: "done" }).eq("id", r.id);
      await logEvent(supabase, ws, lead.id, "execution.approved", session.userName, (await getT(system))("approvedEvent", { name: lead.contact_name, channel: lead.channel }), ex.draft);
      await postSystem(supabase, ws, (await getT(system))("approvedMsg", { user: session.userName, name: lead.contact_name, channel: lead.channel }), lead.id);
    } else {
      await supabase.from("responsibilities").update({ status: "open" }).eq("id", r.id);
      await logEvent(supabase, ws, lead.id, "execution.rejected", session.userName, (await getT(system))("rejectedEvent"));
      await postSystem(supabase, ws, (await getT(system))("rejectedMsg", { user: session.userName, name: lead.contact_name }), lead.id);
    }
    refreshAll();
    return ex;
  });

/**
 * Record the outcome of the journey with its evidence (stage change). A won deal is handed from Sales to Accounting:
 * accounting.issue_invoice runs through the gate; with no agreed amount on record it asks for it (missing data).
 */
export const recordOutcome = async (leadId: string, stage: Lead["stage"], evidence: string): Promise<Outcome<Lead>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const lead = must(await supabase.from("leads").update({ stage }).eq("id", leadId).select().single<Lead>());
    await logEvent(supabase, session.workspace.id, leadId, "outcome.recorded", session.userName, (await getT(system))("stageEvent", { stage: (await getT(system))(`stage_${stage}`) }), evidence || null);
    await postSystem(supabase, session.workspace.id, (await getT(system))("stageMsg", { name: lead.contact_name, stage: (await getT(system))(`stage_${stage}`) }), leadId);
    if (stage === "won") {
      // SME flow: a won deal is handed from Sales to Accounting (owner of the invoice step).
      const acc = ((await supabase.from("agents").select("*").eq("workspace_id", session.workspace.id).eq("module", "accounting").eq("status", "active").limit(1)).data ?? [])[0] as Agent | undefined;
      if (acc) {
        await supabase.from("responsibilities").insert({
          workspace_id: session.workspace.id, lead_id: leadId, title: (await getT(system))("invoiceTitle", { name: lead.contact_name }),
          owner_kind: "agent", owner_agent_id: acc.id, owner_name: acc.name,
          next_action: (await getT(system))("invoiceNext"), due_at: new Date(Date.now() + 86_400_000).toISOString(),
        });
        await logEvent(supabase, session.workspace.id, leadId, "responsibility.assigned", "Sales Agent", (await getT(system))("handedEvent", { agent: acc.name }));
      }
      const c = await engineCtx();
      await runWork(c, {
        action: "issue_invoice", subject_type: "lead", subject_id: leadId, lead_id: leadId, origin: lead.origin ?? "live",
        dedupeKey: `issue_invoice:lead:${leadId}`, seed: { amount_vnd: null, fields: {} },
      });
      drainAfter(c);
    }
    refreshAll();
    return lead;
  });

/** Add the next responsibility after an outcome (keeps the loop going). */
export const addResponsibility = async (leadId: string, input: { title: string; owner: "human" | string; next_action: string; due_at: string | null }): Promise<Outcome<Responsibility>> =>
  run(async () => {
    const { session, supabase } = await ctx();
    const agent = input.owner === "human" ? null : must(await supabase.from("agents").select("*").eq("id", input.owner).single<Agent>());
    const r = must(
      await supabase.from("responsibilities").insert({
        workspace_id: session.workspace.id, lead_id: leadId, title: input.title,
        owner_kind: agent ? "agent" : "human", owner_agent_id: agent?.id ?? null, owner_name: agent?.name ?? session.userName,
        next_action: input.next_action, due_at: input.due_at,
      }).select().single<Responsibility>(),
    );
    await logEvent(supabase, session.workspace.id, leadId, "responsibility.assigned", session.userName, (await getT(system))("ownerNext", { owner: r.owner_name, next: r.next_action }));
    refreshAll();
    return r;
  });

/* ------------------------------------------------------------------ team chat (Office) */

/**
 * Post in the team chat, as the signed-in owner or (asStaffId, "Nhắn với tư cách") as an active staff member: staff have
 * no logins in the prototype, so the owner writes on their behalf and the message carries the staff member's name.
 * Owner messages go to NIVO first: "@nivo …" grants authority (goals, policies, rules) and decisions typed in chat
 * ("đồng ý", "duyệt đơn 45 triệu", "từ chối") resume the matching waiting work; NIVO answers in the thread.
 * Then the Chatbot checks whether the message answers a customer question it escalated (relayStaffAnswer): if so it
 * rewrites the answer for the customer, resolves the waiting reply_customer item with the author as decider (the reply
 * reaches the customer's channel) and confirms in Office. Staff messages never grant authority or decide by typed words.
 * Otherwise, mentioning @handle of an active agent makes that agent reply (its brief includes waiting decisions).
 */
export const sendTeamMessage = async (body: string, asStaffId?: string | null): Promise<Outcome<Message[]>> =>
  run(async () => {
    const c = await engineCtx();
    const { session, db: supabase, ws } = c;
    const staff = asStaffId ? await staffMember(c, asStaffId) : null;
    const author = { name: staff?.name ?? session.userName, staffId: staff?.id ?? null };
    const mine = await insertHumanMessage(c, { author_name: author.name, staff_id: author.staffId, body });
    const out: Message[] = [mine];

    if (!staff) {
      const owner = await ownerChatForOffice(body);
      if (owner.handled) {
        if (owner.reply && !owner.posted) {
          out.push(must(await supabase.from("messages").insert({ workspace_id: ws, author_kind: "system", author_name: "NIVO", body: owner.reply }).select().single<Message>()));
        }
        refreshAll();
        return out;
      }
    }

    const relayed = await relayStaffAnswer(c, { text: body, author });
    if (relayed) {
      out.push(...relayed);
      drainAfter(c);
      refreshAll();
      return out;
    }

    const handles = [...body.matchAll(/@([a-z0-9-]+)/g)].map((m) => m[1]);
    if (handles.length) {
      const t = translator(system, c.locale);
      const agents = ((await supabase.from("agents").select("*").eq("workspace_id", ws).eq("status", "active").in("handle", handles)).data ?? []) as Agent[];
      const recent = ((await supabase.from("messages").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(20)).data ?? []) as Message[];
      const transcript = recent.reverse().map((m) => `${m.author_name}: ${m.body}`);
      const open = ((await supabase.from("responsibilities").select("title, owner_name, next_action, status").eq("workspace_id", ws).neq("status", "done")).data ?? [])
        .map((r) => `- ${r.title} (owner ${r.owner_name}, ${r.status}): ${r.next_action}`).join("\n");
      const waiting = ((await supabase.from("work_items").select("department, action, reason, proposal").eq("workspace_id", ws).eq("status", "waiting_decision").order("created_at").limit(10)).data ?? []) as Pick<WorkItem, "department" | "action" | "reason" | "proposal">[];
      const waitingBrief = `${t("waitingBrief")}\n${waiting.map((w) => `- [${gov(c)(`reason_${w.reason ?? "routine"}`)}] ${gov(c)(`dept_${w.department}`)} · ${gov(c)(`action_${w.action}`)}: ${w.proposal?.summary ?? ""}`).join("\n") || t("noWaiting")}`;
      const brief = ai.authorityBrief(await loadAuthority(c));
      for (const a of agents) {
        const text = await ai.agentReply(agentInput(a), transcript, `${open || "(no open responsibilities)"}\n${waitingBrief}`, brief);
        out.push(must(await supabase.from("messages").insert({ workspace_id: ws, author_kind: "agent", author_name: a.name, agent_id: a.id, body: text }).select().single<Message>()));
      }
    }
    revalidatePath("/chat");
    return out;
  });

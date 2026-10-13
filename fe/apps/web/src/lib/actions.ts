"use server"

import { revalidatePath } from "next/cache"
import { getLocale } from "next-intl/server"
import * as ai from "./deepseek"
import { moduleSpec } from "./modules"
import { getSession } from "./session"
import { supabaseServer } from "./supabase/server"
import { getT } from "@/i18n/server"
import { navigation } from "@/modules/i18n"
import { loginPath } from "@/modules/routes"
import { system } from "@/i18n/dict/system"
import { governance } from "@/i18n/dict/governance"
import { translator } from "@/i18n/core"
import { loadAuthority, resumeWork, runWork, type EngineCtx } from "./engine"
import { drainAfter, engineCtx } from "./flow-ctx"
import { customerTurn } from "./customer-turn"
import { withUsage } from "./usage"
import { ownerChatForOffice } from "./flow-actions"
import { emitEvent } from "./outbound-events"
import { insertHumanMessage, relayStaffAnswer } from "./staff-relay"
import { access } from "@/i18n/dict/access"
import { deciderOf, requireDecide, requireManager } from "./permissions"
import { isManagerRole } from "./members-shared"
import { proposeOfficeCommand } from "./office-command"
import type { WorkItem } from "./flow-types"
import { noteIntent, proposeContextNote } from "./context-notes"
import { knowledgeBrief } from "./knowledge/runtime"
import { knowledge as knowledgeDict } from "@/i18n/dict/knowledge"
import type {
    Agent,
    AgentConversation,
    AgentMessage,
    Execution,
    Lead,
    Message,
    ModuleKey,
    Outcome,
    Responsibility,
} from "./types"

/* ------------------------------------------------------------------ helpers */

const ctx = async () => ({ session: await getSession(), supabase: await supabaseServer() })

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
    try {
        return { ok: true, data: await fn() }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** What a database call answers: the row or the failure. */
interface DbAnswer<T> {
    readonly data: T | null
    readonly error: { readonly message: string } | null
}

const must = <T>(res: DbAnswer<T>): T => {
    if (res.error) throw new Error(res.error.message)
    if (res.data === null) throw new Error("Not found")
    return res.data
}

const refreshAll = () => {
    revalidatePath("/", "layout")
}

type Db = Awaited<ReturnType<typeof supabaseServer>>

const logEvent = (
    supabase: Db,
    workspace_id: string,
    lead_id: string | null,
    kind: string,
    actor: string,
    summary: string,
    evidence: string | null = null,
) => supabase.from("events").insert({ workspace_id, lead_id, kind, actor, summary, evidence })

const postSystem = (supabase: Db, workspace_id: string, body: string, lead_id: string | null = null) =>
    supabase.from("messages").insert({ workspace_id, author_kind: "system", author_name: "NIVO", body, lead_id })
const gov = (c: EngineCtx) => translator(governance, c.locale) as (k: string) => string
const agentInput = (a: Agent): ai.AgentInput => ({
    name: a.name,
    handle: a.handle,
    role: a.role,
    instructions: a.instructions,
    knowledge: a.knowledge,
    approval_rule: a.approval_rule,
})

/* ------------------------------------------------------------------ auth */

/** Ends the signed-in session and sends the person to the login page of their locale. */
export const signOut = async () => {
    const supabase = await supabaseServer()
    await supabase.auth.signOut()
    navigation.redirect({ href: loginPath(), locale: await getLocale() })
}

/* ------------------------------------------------------------------ agents (modules) */

/** The setup a person gives an agent: identity, role, instructions, knowledge, greeting and the approval rule. */
export type AgentSetupInput = {
    name: string
    handle: string
    role: string
    instructions: string
    knowledge: string
    greeting: string
    approval_rule: string
}

/** Install a module as a new agent. Only available modules (Chatbot in this build) can be installed. */
export const installAgent = async (module: ModuleKey, input: Partial<AgentSetupInput> = {}): Promise<Outcome<Agent>> =>
    run(async () => {
        await requireManager()
        const spec = moduleSpec(module)
        if (!spec.available) throw new Error(`${spec.name} is already included with this workspace.`)
        const { session, supabase } = await ctx()
        const handle =
            (input.handle || spec.key)
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "")
                .slice(0, 16) || spec.key
        const agent = must(
            await supabase
                .from("agents")
                .insert({
                    workspace_id: session.workspace.id,
                    module,
                    name: input.name || `${spec.name} Agent`,
                    handle,
                    role: input.role || spec.defaultRole,
                    instructions: input.instructions || spec.defaultInstructions,
                    knowledge: input.knowledge ?? "",
                    greeting: input.greeting ?? "",
                    ...(input.approval_rule ? { approval_rule: input.approval_rule } : {}),
                })
                .select()
                .single<Agent>(),
        )
        await postSystem(
            supabase,
            session.workspace.id,
            (await getT(system))("bought", {
                user: session.userName,
                module: spec.name,
                agent: agent.name,
                handle: agent.handle,
            }),
        )
        await logEvent(
            supabase,
            session.workspace.id,
            null,
            "module.purchased",
            session.userName,
            (await getT(system))("boughtEvent", { module: spec.name, agent: agent.name }),
        )
        refreshAll()
        return agent
    })

/** AI helper for the setup form: turn a plain description into a suggested agent setup. */
export const suggestAgentSetup = async (
    description: string,
): Promise<Outcome<{ name: string; handle: string; role: string; instructions: string }>> =>
    run(async () => {
        const { session } = await ctx()
        return withUsage({ workspaceId: session.workspace.id }, () => ai.designModule(description))
    })

/** The fields of an agent a manager may change: its setup and whether it is active. */
type AgentUpdate = Partial<AgentSetupInput> & { status?: "active" | "paused" }

/** Changes the setup or the status of an agent (manager only) and records the change in the event log. */
export const updateAgent = async (agentId: string, input: AgentUpdate): Promise<Outcome<Agent>> =>
    run(async () => {
        await requireManager()
        const { session, supabase } = await ctx()
        const agent = must(await supabase.from("agents").update(input).eq("id", agentId).select().single<Agent>())
        await logEvent(
            supabase,
            session.workspace.id,
            null,
            "agent.updated",
            session.userName,
            (await getT(system))("updatedSetup", { agent: agent.name }),
        )
        refreshAll()
        return agent
    })

/* ------------------------------------------------------------------ agent chat (1:1) */

/** The 1:1 conversations with an agent, newest first. */
export const listConversations = async (agentId: string): Promise<AgentConversation[]> => {
    const { supabase } = await ctx()
    const { data } = await supabase
        .from("agent_conversations")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
    return (data ?? []) as AgentConversation[]
}

/** The messages of one 1:1 conversation, oldest first. */
export const listAgentMessages = async (conversationId: string): Promise<AgentMessage[]> => {
    const { supabase } = await ctx()
    const { data } = await supabase
        .from("agent_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at")
    return (data ?? []) as AgentMessage[]
}

/** Open a new 1:1 conversation: "test" (owner tries the agent) or "customer" (simulated customer channel). */
export const startConversation = async (
    agentId: string,
    kind: "test" | "customer",
    visitorName?: string,
): Promise<Outcome<AgentConversation>> =>
    run(async () => {
        const { session, supabase } = await ctx()
        const agent = must(await supabase.from("agents").select("*").eq("id", agentId).single<Agent>())
        const conv = must(
            await supabase
                .from("agent_conversations")
                .insert({
                    workspace_id: session.workspace.id,
                    agent_id: agentId,
                    kind,
                    visitor_name: visitorName ?? (kind === "customer" ? "Website visitor" : session.userName),
                })
                .select()
                .single<AgentConversation>(),
        )
        if (agent.greeting) {
            await supabase.from("agent_messages").insert({
                workspace_id: session.workspace.id,
                conversation_id: conv.id,
                role: "agent",
                body: agent.greeting,
            })
        }
        return conv
    })

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
        const c = await engineCtx()
        const { db: supabase, ws } = c
        const conv = must(
            await supabase.from("agent_conversations").select("*").eq("id", conversationId).single<AgentConversation>(),
        )
        const agent = must(await supabase.from("agents").select("*").eq("id", conv.agent_id).single<Agent>())
        if (conv.kind === "customer") {
            let turn: Awaited<ReturnType<typeof customerTurn>> | null = null
            try {
                turn = await withUsage({ workspaceId: ws }, () => customerTurn(c, conv, agent, body))
            } finally {
                // The customer's message is stored before the model runs, so automations hear about it even when the reply could not be produced.
                await emitEvent(
                    ws,
                    "message.inbound",
                    {
                        conversation_id: conv.id,
                        lead_id: turn?.capturedLeadId ?? conv.lead_id,
                        channel: "website",
                        text: body,
                        agent_id: agent.id,
                    },
                    `message.inbound:${turn?.reply.id ?? `${conv.id}:${Date.now()}`}`,
                )
            }
            if (turn.changed) refreshAll()
            return { reply: turn.reply, capturedLeadId: turn.capturedLeadId }
        }
        must(
            await supabase
                .from("agent_messages")
                .insert({ workspace_id: ws, conversation_id: conv.id, role: "user", body })
                .select()
                .single<AgentMessage>(),
        )
        const history = ((
            await supabase.from("agent_messages").select("*").eq("conversation_id", conv.id).order("created_at")
        ).data ?? []) as AgentMessage[]
        const turns: ai.ChatTurn[] = history
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role === "user" ? "user" : "agent", body: m.body }))
        const text = await withUsage({ workspaceId: ws }, async () =>
            ai.testChat(
                agentInput(agent),
                turns,
                ai.authorityBrief(await loadAuthority(c)) + (await knowledgeBrief(c, agent.module, body, "customer")),
            ),
        )
        const reply = must(
            await supabase
                .from("agent_messages")
                .insert({ workspace_id: ws, conversation_id: conv.id, role: "agent", body: text })
                .select()
                .single<AgentMessage>(),
        )
        return { reply, capturedLeadId: null }
    })

/**
 * The owning agent drafts the message that performs the next action (sales.send_follow_up through the gate).
 * Inside the granted authority it is sent by itself and the execution is recorded as approved by NIVO;
 * otherwise it waits for approval as before (execution pending_approval, linked to the work item).
 */
export const draftExecution = async (responsibilityId: string): Promise<Outcome<Execution>> =>
    run(async () => {
        const c = await engineCtx()
        const r = must(
            await c.db.from("responsibilities").select("*").eq("id", responsibilityId).single<Responsibility>(),
        )
        const lead = must(await c.db.from("leads").select("*").eq("id", r.lead_id).single<Lead>())
        const item = await runWork(c, {
            action: "send_follow_up",
            subject_type: "lead",
            subject_id: lead.id,
            lead_id: lead.id,
            origin: lead.origin ?? "live",
            dedupeKey: `send_follow_up:resp:${r.id}:${Date.now()}`,
            noChain: true,
            seed: { fields: { responsibility_id: r.id } },
        })
        if (item.status === "failed") throw new Error(item.error ?? "Could not draft")
        const exId =
            item.execution_id ??
            ((await c.db.from("work_items").select("execution_id").eq("id", item.id).single()).data?.execution_id as
                string | null)
        if (!exId) {
            // Waiting for missing data (no contact yet): the Office exception card asks for it.
            throw new Error(
                translator(system, c.locale)("stillMissing", {
                    fields: item.missing_fields.map((f) => gov(c)(`field_${f}`)).join(", "),
                }),
            )
        }
        refreshAll()
        return must(await c.db.from("executions").select("*").eq("id", exId).single<Execution>())
    })

/**
 * Owner approves (optionally edits) or rejects a draft. When the draft belongs to a work item, the engine resumes
 * that same work (guarded, so a double click is safe); otherwise the legacy approval path records it.
 */
export const decideExecution = async (
    executionId: string,
    decision: "approved" | "rejected",
    editedDraft?: string,
): Promise<Outcome<Execution>> =>
    run(async () => {
        const { session, supabase } = await ctx()
        const ws = session.workspace.id
        const current = must(await supabase.from("executions").select("*").eq("id", executionId).single<Execution>())
        const by = deciderOf(session.member)
        if (current.work_item_id) {
            const c = await engineCtx()
            if (current.status !== "pending_approval") throw new Error(translator(system, c.locale)("alreadyDecided"))
            const wi = must(
                await supabase
                    .from("work_items")
                    .select("assigned_staff_id")
                    .eq("id", current.work_item_id)
                    .maybeSingle<Pick<WorkItem, "assigned_staff_id">>(),
            )
            await requireDecide(wi, c.locale)
            await resumeWork(c, current.work_item_id, decision, editedDraft ? { draft: editedDraft } : {}, by)
            // The engine records the execution as approved when it performs; a rejection is recorded here.
            if (decision === "rejected") {
                await supabase
                    .from("executions")
                    .update({
                        status: "rejected",
                        decided_by: session.userName,
                        decided_at: new Date().toISOString(),
                        ...(editedDraft ? { draft: editedDraft } : {}),
                    })
                    .eq("id", executionId)
            }
            drainAfter(c)
            refreshAll()
            return must(await supabase.from("executions").select("*").eq("id", executionId).single<Execution>())
        }
        // A legacy draft without a work item has no assignee: owner and manager only.
        if (by.kind === "staff") throw new Error((await getT(access))("forbiddenDecide"))
        const ex = must(
            await supabase
                .from("executions")
                .update({
                    status: decision,
                    decided_by: session.userName,
                    decided_at: new Date().toISOString(),
                    ...(editedDraft ? { draft: editedDraft } : {}),
                })
                .eq("id", executionId)
                .eq("status", "pending_approval")
                .select()
                .single<Execution>(),
        )
        const r = must(
            await supabase.from("responsibilities").select("*").eq("id", ex.responsibility_id).single<Responsibility>(),
        )
        const lead = must(await supabase.from("leads").select("*").eq("id", r.lead_id).single<Lead>())
        if (decision === "approved") {
            await supabase.from("responsibilities").update({ status: "done" }).eq("id", r.id)
            await logEvent(
                supabase,
                ws,
                lead.id,
                "execution.approved",
                session.userName,
                (await getT(system))("approvedEvent", { name: lead.contact_name, channel: lead.channel }),
                ex.draft,
            )
            await postSystem(
                supabase,
                ws,
                (await getT(system))("approvedMsg", {
                    user: session.userName,
                    name: lead.contact_name,
                    channel: lead.channel,
                }),
                lead.id,
            )
        } else {
            await supabase.from("responsibilities").update({ status: "open" }).eq("id", r.id)
            await logEvent(
                supabase,
                ws,
                lead.id,
                "execution.rejected",
                session.userName,
                (await getT(system))("rejectedEvent"),
            )
            await postSystem(
                supabase,
                ws,
                (await getT(system))("rejectedMsg", { user: session.userName, name: lead.contact_name }),
                lead.id,
            )
        }
        refreshAll()
        return ex
    })

/* ------------------------------------------------------------------ team chat (Office) */

/**
 * Post in the team chat as the signed-in member (author = their display name, staff_id = their staff row when they are one).
 * Owner and manager messages go to NIVO first: "@nivo …" grants authority (goals, policies, rules) and decisions typed in
 * chat (Vietnamese phrases for agree, approve the order of 45 million, reject) resume the matching waiting work; NIVO answers in the thread. A staff
 * member who addresses NIVO that way gets a friendly "not allowed" instead.
 * Then the Chatbot checks whether the message answers a customer question it escalated (relayStaffAnswer): it counts when
 * the author is the staff member the open reply_customer item is assigned to; the Chatbot rewrites it for the customer,
 * resolves the item with that member as decider (the reply reaches the customer's channel) and confirms in Office.
 * Otherwise, mentioning @handle of an active agent makes that agent reply (its brief includes waiting decisions).
 */
export const sendTeamMessage = async (body: string): Promise<Outcome<Message[]>> =>
    run(async () => {
        const c = await engineCtx()
        const { session, db: supabase, ws } = c
        // Every message is written by the signed-in member: their name, and their staff row when they are one.
        const { member } = session
        const author = { name: member.displayName, staffId: member.staffId, role: member.role }
        const mine = await insertHumanMessage(c, { author_name: author.name, staff_id: author.staffId, body })
        const out: Message[] = [mine]

        {
            // @nivo authority commands and typed decisions: owner and manager (a staff member gets a friendly "not allowed").
            const owner = await ownerChatForOffice(body)
            if (owner.handled) {
                if (owner.reply && !owner.posted) {
                    out.push(
                        must(
                            await supabase
                                .from("messages")
                                .insert({
                                    workspace_id: ws,
                                    author_kind: "system",
                                    author_name: "NIVO",
                                    body: owner.reply,
                                })
                                .select()
                                .single<Message>(),
                        ),
                    )
                }
                refreshAll()
                return out
            }
        }

        const relayed = await relayStaffAnswer(c, { text: body, author })
        if (relayed) {
            out.push(...relayed)
            drainAfter(c)
            refreshAll()
            return out
        }

        const handles = [...body.matchAll(/@([a-z0-9-]+)/g)].map((m) => m[1])
        if (handles.length) {
            const t = translator(system, c.locale)
            const agents = ((
                await supabase
                    .from("agents")
                    .select("*")
                    .eq("workspace_id", ws)
                    .eq("status", "active")
                    .in("handle", handles)
            ).data ?? []) as Agent[]
            const recent = ((
                await supabase
                    .from("messages")
                    .select("*")
                    .eq("workspace_id", ws)
                    .order("created_at", { ascending: false })
                    .limit(20)
            ).data ?? []) as Message[]
            const transcript = recent.reverse().map((m) => `${m.author_name}: ${m.body}`)
            const open = (
                (
                    await supabase
                        .from("responsibilities")
                        .select("title, owner_name, next_action, status")
                        .eq("workspace_id", ws)
                        .neq("status", "done")
                ).data ?? []
            )
                .map((r) => `- ${r.title} (owner ${r.owner_name}, ${r.status}): ${r.next_action}`)
                .join("\n")
            const waiting = ((
                await supabase
                    .from("work_items")
                    .select("department, action, reason, proposal")
                    .eq("workspace_id", ws)
                    .eq("status", "waiting_decision")
                    .order("created_at")
                    .limit(10)
            ).data ?? []) as Pick<WorkItem, "department" | "action" | "reason" | "proposal">[]
            const waitingBrief = `${t("waitingBrief")}\n${waiting.map((w) => `- [${gov(c)(`reason_${w.reason ?? "routine"}`)}] ${gov(c)(`dept_${w.department}`)} · ${gov(c)(`action_${w.action}`)}: ${w.proposal?.summary ?? ""}`).join("\n") || t("noWaiting")}`
            const brief = ai.authorityBrief(await loadAuthority(c))
            const note = noteIntent(body)
            // Owner / manager mentioning exactly ONE agent: read the message into a command candidate (one metered call) and show the confirm card.
            // A staff mention never creates a command: it stays a mention below. Null means this agent accepts no commands, so it chats as before.
            if (isManagerRole(member.role) && !note && handles.length === 1 && agents.length === 1) {
                const proposed = await proposeOfficeCommand(c, {
                    message: mine,
                    agent: agents[0],
                    body,
                    author: member.displayName,
                }).catch((): null => null)
                if (proposed) {
                    out.push(...proposed)
                    revalidatePath("/chat")
                    return out
                }
            }
            /** One agent's reply, written and stored: a context note it was asked to remember, else its answer. */
            const replyOf = async (a: Agent): Promise<Message> => {
                // "@Chatbot remember: ..." (in Vietnamese) is a note for the agent's context: proposed in its draft (always a proposal; a manager approves it in Setup).
                if (note) {
                    const proposed = await proposeContextNote({
                        workspaceId: ws,
                        agentId: a.id,
                        text: note,
                        author: { userId: session.userId, name: member.displayName, role: member.role },
                        locale: c.locale,
                    }).catch(() => null)
                    if (proposed) {
                        const reply = translator(knowledgeDict, c.locale)("noteRecorded", {
                            agent: a.name,
                            module: proposed.moduleKey,
                        })
                        return must(
                            await supabase
                                .from("messages")
                                .insert({
                                    workspace_id: ws,
                                    author_kind: "agent",
                                    author_name: a.name,
                                    agent_id: a.id,
                                    body: reply,
                                })
                                .select()
                                .single<Message>(),
                        )
                    }
                }
                const text = await withUsage({ workspaceId: ws }, async () =>
                    ai.agentReply(
                        agentInput(a),
                        transcript,
                        `${open || "(no open responsibilities)"}\n${waitingBrief}`,
                        brief + (await knowledgeBrief(c, a.module, body, "internal")),
                    ),
                )
                return must(
                    await supabase
                        .from("messages")
                        .insert({
                            workspace_id: ws,
                            author_kind: "agent",
                            author_name: a.name,
                            agent_id: a.id,
                            body: text,
                        })
                        .select()
                        .single<Message>(),
                )
            }
            // The agents answer one after the other, in the order they were mentioned.
            const replies = await agents.reduce<Promise<Message[]>>(
                async (done, a) => [...(await done), await replyOf(a)],
                Promise.resolve([]),
            )
            out.push(...replies)
        }
        revalidatePath("/chat")
        return out
    })

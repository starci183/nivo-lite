import "server-only"
import { agentsFor, routeInbound } from "./agent-bindings"
import { sendCommand, sendCommandItem } from "./agent-commands"
import type { Db } from "./core"
import type { EngineCtx } from "./engine"
import { drainAfter } from "./flow-ctx"
import {
    ensureConversation,
    flowCandidates,
    heldByPerson,
    patchFlow,
    sayInConversation,
    type FlowRow,
} from "./lead-flow"
import { matchFlow, type SourceKind } from "./lead-flow-rules"
import type { MetaEvent } from "./meta-core"
import type { Agent } from "./types"

/**
 * Facebook / Instagram events that belong to the lead_gen agent. The agent is bound to a Meta connection as `lead_source` (connection-access.ts);
 * meta-inbound.ts asks here first and falls back to the chatbot front door when this says no.
 *
 *   comment, mention      always lead_gen (no chatbot answers a comment when a lead agent listens)
 *   dm, postback          lead_gen when no chatbot is bound, or the person already has a live flow, or came from an ad (referral)
 *   leadgen (form)        handled in meta-inbound.handleLead (capture_lead), not here
 *
 * What an event becomes:
 *   a person with a flow, writing in a DM  ->  the message is stored, the 24 hour window moves, and a score_lead turn is queued
 *   anybody else                           ->  capture_lead (create or merge the lead, keep the source), whose chain scores and answers it
 * The model is never called here: the turn's one call happens in score_lead, after the response (drainAfter).
 */

const LOCALE = "vi" as const
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s)

/** The flow states a chatbot front door may take back (the lead is done or handed to Sales). */
const FRONT_TAKES: ReadonlySet<string> = new Set(["handed_off", "closed"])

/** The lead_gen agent that should take this event, or null when the chatbot / nobody does. */
export const leadGenFor = async (
    db: Db,
    conn: { readonly id: string; readonly workspaceId: string },
    ev: MetaEvent,
): Promise<Agent | null> => {
    const bound = await agentsFor(conn.id, "lead_source", { acting: true, modules: ["lead_gen"] }).catch(() => [])
    if (!bound.length) return null
    const agent = ((
        await db.from("agents").select("*").eq("workspace_id", conn.workspaceId).eq("id", bound[0].id).maybeSingle()
    ).data ?? null) as Agent | null
    if (!agent) return null
    if (ev.kind === "comment" || ev.kind === "mention") return agent
    if (ev.kind !== "dm" && ev.kind !== "postback") return null
    const front = (await routeInbound(conn.id).catch(() => ({ front: null }))).front
    if (!front) return agent
    const id = { psid: ev.sender_psid, igsid: ev.sender_igsid, phone: null, email: null }
    const flow = matchFlow(await flowCandidates(db, conn.workspaceId, id), id, conn.id)?.row ?? null
    if (flow) return FRONT_TAKES.has(flow.state) ? null : agent
    return ev.referral ? agent : null
}

const kindOf = (ev: MetaEvent): SourceKind =>
    ev.kind === "comment" ? "comment" : ev.kind === "mention" ? "mention" : "dm"

export type LeadGenInput = {
    readonly agent: Agent
    /** the stored inbound_event of this delivery */
    readonly eventId: string
    readonly name: string
    readonly text: string
    readonly connectionId: string
}

/**
 * Turn one event into lead_gen work. Idempotent: every command carries a key derived from the event (Meta redelivers), so a retry creates nothing new.
 */
export const handleLeadGenEvent = async (db: Db, ws: string, ev: MetaEvent, a: LeadGenInput): Promise<void> => {
    const c: EngineCtx = { db, ws, actor: ev.platform === "instagram" ? "Instagram" : "Facebook", locale: LOCALE }
    const kind = kindOf(ev)
    const id = { psid: ev.sender_psid, igsid: ev.sender_igsid, phone: null, email: null }
    const turn = `t:${ev.event_key}`
    const adId = ev.ad_id ?? ev.referral?.ad_id ?? null

    const flow: FlowRow | null =
        kind === "dm" || kind === "comment"
            ? (matchFlow(await flowCandidates(db, ws, id), id, a.connectionId)?.row ?? null)
            : null

    if (flow && flow.lead_id && kind === "dm") {
        const externalId =
            (ev.platform === "instagram" ? (flow.igsid ?? ev.sender_igsid) : (flow.psid ?? ev.sender_psid)) ?? ""
        const conv = externalId ? await ensureConversation({ db, ws }, { flow, externalId, agentId: a.agent.id }) : null
        // The window moved (meta-inbound.touchThread); keep the transcript and the last words on the flow.
        await sayInConversation(db, ws, conv?.id ?? flow.conversation_id, "user", a.text || "[tệp đính kèm]")
        const held = await heldByPerson(db, ws, flow, conv?.id)
        let state = flow.state
        const patch: Record<string, unknown> = {
            last_user_at: new Date(ev.timestamp).toISOString(),
            last_user_text: clip(a.text, 1000),
            ...(conv ? { conversation_id: conv.id } : {}),
        }
        if (state === "escalated") {
            // A person has this conversation. Silent while they hold it; when they hand it back the bot resumes where it was.
            if (held) {
                await patchFlow(db, flow.id, patch)
                return
            }
            state = flow.resume_state ?? "qualifying"
            Object.assign(patch, { state, resume_state: null, escalated_at: null, escalation_reason: null })
        }
        // A lead that was closed as cold writes again: the conversation reopens (the answers and the 4-question budget are kept).
        if (state === "closed") {
            state = "qualifying"
            Object.assign(patch, { state, closed_at: null })
        }
        await patchFlow(db, flow.id, patch)
        // Sales or a person already has a handed-over lead: the message is kept, the bot says nothing more.
        if (state === "handed_off") return
        await sendCommand(c, {
            from: "inbound",
            to: "lead_gen",
            command: "score_lead",
            reason: "customer_turn",
            origin: "live",
            inboundEventId: a.eventId,
            queue: true,
            dedupeKey: `score_lead:${flow.lead_id}:${turn}`,
            payload: {
                subject_type: "lead",
                subject_id: flow.lead_id,
                lead_id: flow.lead_id,
                turn,
                text: a.text,
                source_kind: "dm",
                conversation_id: conv?.id ?? flow.conversation_id ?? "",
                connection_id: a.connectionId,
            },
        })
        drainAfter(c, 4)
        return
    }

    // A new person, or a comment / mention (a comment from a known person is a new touch of the same lead).
    await sendCommandItem(c, {
        from: "inbound",
        to: "lead_gen",
        command: "capture_lead",
        reason: `meta_${kind}`,
        origin: "live",
        inboundEventId: a.eventId,
        dedupeKey: `capture_lead:inbound:${a.eventId}`,
        payload: {
            subject_type: "inbound",
            subject_id: a.eventId,
            contact_name: a.name,
            company: "",
            need: clip(a.text, 300),
            contact: "",
            channel_label: "",
            platform: ev.platform,
            source_kind: kind,
            psid: ev.sender_psid ?? "",
            igsid: ev.sender_igsid ?? "",
            post_id: ev.post_id ?? "",
            ad_id: adId ?? "",
            form_id: ev.form_id ?? "",
            comment_id: ev.comment_id ?? "",
            referral: ev.referral ? JSON.stringify(ev.referral) : "",
            connection_id: a.connectionId,
            text: a.text,
            message_at: ev.timestamp,
            turn,
        },
    })
    drainAfter(c, 4)
}

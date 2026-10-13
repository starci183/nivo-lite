import "server-only"
import { revalidatePath } from "next/cache"
import { agentsFor, INBOUND_MODULES, routeInbound } from "./agent-bindings"
import { ingest } from "./core"
import type { Db } from "./core"
import { sendCommandItem } from "./agent-commands"
import { customerTurn, type CustomerChannel } from "./customer-turn"
import { runWork, type EngineCtx } from "./engine"
import { drainAfter } from "./flow-ctx"
import { handleLeadGenEvent, leadGenFor } from "./lead-flow-inbound"
import {
    fetchLead,
    fetchMention,
    fetchProfileName,
    loadMetaPage,
    MetaGraphError,
    noteComment,
    touchThread,
    type MetaPage,
} from "./meta"
import type { MetaEvent, MetaLead } from "./meta-core"
import { supabaseAdmin } from "./supabase/admin"
import type { Agent, AgentConversation } from "./types"

/**
 * Normalised Meta events (meta-core parseWebhook) -> the workspace. One webhook serves every connected Page, so the first step is the
 * connection: the Page id (Facebook) or Instagram account id (Instagram) of the event finds the one live `meta` connection that owns it.
 * Then, for each event, exactly once (receipt `meta:<connection>:<event key>`):
 *   1. the event is stored as an inbound_event (channel facebook | instagram, the same table and dedupe as every other channel);
 *   2. a person's message or a comment opens (or moves forward) the 24 hour window / the 7 day private-reply window (meta_threads, meta_comments);
 *   3. it is dispatched through the agent bindings (agent-bindings.ts): dm, postback, comment and mention go to the connection's
 *      `inbound_chat` front door exactly like Telegram and Zalo (customerTurn: the reply passes the authority gate, then deliverMeta
 *      sends it); a leadgen goes to the agents bound `lead_source`: the lead_gen agent when bound (capture_lead, then handoff_to_sales -> Sales classify_lead), else Sales (handoff_lead).
 * A connection nobody is bound to still stores the event (nobody answers it).
 */
export type MetaResult = {
    readonly event_key: string
    readonly handled: boolean
    readonly reason?: "duplicate" | "no_connection" | "no_agent" | "no_text" | "lead_unreadable"
}

const LOCALE = "vi" as const
const ACTOR: Readonly<Record<"facebook" | "instagram", string>> = { facebook: "Facebook", instagram: "Instagram" }
const LABEL: Readonly<Record<"facebook" | "instagram", CustomerChannel>> = {
    facebook: { key: "facebook", label: "Facebook Messenger" },
    instagram: { key: "instagram", label: "Instagram" },
}
const FALLBACK_NAME: Readonly<Record<"facebook" | "instagram", string>> = {
    facebook: "Khách Facebook",
    instagram: "Khách Instagram",
}

type Conn = { readonly id: string; readonly workspaceId: string }

/** The live `meta` connection that owns this Page / Instagram account. */
export const findMetaConnection = async (
    db: Db,
    ev: Pick<MetaEvent, "platform" | "page_id" | "ig_id">,
): Promise<Conn | null> => {
    const id = ev.platform === "facebook" ? ev.page_id : ev.ig_id
    if (!id) return null
    const { data } = await db
        .from("connections")
        .select("id, workspace_id")
        .eq("provider", "meta")
        .neq("status", "disconnected")
        .eq(ev.platform === "facebook" ? "public_meta->>page_id" : "public_meta->>ig_id", id)
        .order("created_at")
        .limit(1)
    const row = (data as Array<{ id: string; workspace_id: string }> | null)?.[0]
    return row ? { id: row.id, workspaceId: row.workspace_id } : null
}

/** One delivery is processed once: Meta redelivers until it gets a 200. False when this event was already taken. */
const claim = async (db: Db, ws: string, receipt: string): Promise<boolean> => {
    const { error } = await db
        .from("channel_receipts")
        .insert({ workspace_id: ws, channel: "meta", receipt_id: receipt })
    if (!error) return true
    if (error.code === "23505") return false
    console.error("meta webhook: could not record the receipt", error.message)
    return true
}

const release = async (db: Db, ws: string, receipt: string): Promise<void> => {
    await db.from("channel_receipts").delete().eq("workspace_id", ws).eq("channel", "meta").eq("receipt_id", receipt)
}

/** The connection works (pending / error -> connected) and the wizard's test step can say who wrote first. */
const markReceived = async (db: Db, connectionId: string, name: string, text: string): Promise<void> => {
    const { data: c } = await db
        .from("connections")
        .select("status, first_event")
        .eq("id", connectionId)
        .maybeSingle<{ status: string; first_event: unknown }>()
    const at = new Date().toISOString()
    await db
        .from("connections")
        .update({
            last_event_at: at,
            updated_at: at,
            ...(c?.status === "pending" || c?.status === "error" ? { status: "connected", last_error: null } : {}),
            ...(c?.first_event ? {} : { first_event: { amount: 0, content: name, at, text: text.slice(0, 160) } }),
        })
        .eq("id", connectionId)
}

const leadNeed = (lead: MetaLead, ev: MetaEvent): string => {
    const answers = Object.entries(lead.fields)
        .filter(
            ([k]) => !["full_name", "name", "first_name", "last_name", "phone_number", "phone", "email"].includes(k),
        )
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    return [
        `Facebook Lead Ads${ev.form_id ? ` (form ${ev.form_id}${ev.ad_id ? `, ad ${ev.ad_id}` : ""})` : ""}`,
        ...answers,
    ]
        .join("\n")
        .slice(0, 600)
}

const markProcessed = async (db: Db, eventId: string): Promise<void> => {
    await db.from("inbound_events").update({ status: "processed" }).eq("id", eventId)
}

/** The conversation of this person (or comment) on this connection, created on first contact; it follows the connection's current front door. */
const conversationFor = async (
    db: Db,
    ws: string,
    conn: Conn,
    ev: MetaEvent,
    agent: Agent,
    name: string,
): Promise<AgentConversation> => {
    const externalId =
        ev.kind === "comment" || ev.kind === "mention"
            ? `comment:${ev.comment_id}`
            : (ev.sender_psid ?? ev.sender_igsid ?? "")
    const found = ((
        await db
            .from("agent_conversations")
            .select("*")
            .eq("workspace_id", ws)
            .eq("channel", ev.platform)
            .eq("external_id", externalId)
            .maybeSingle()
    ).data ?? null) as AgentConversation | null
    if (found) {
        if (found.agent_id === agent.id) return found
        await db.from("agent_conversations").update({ agent_id: agent.id }).eq("id", found.id)
        return { ...found, agent_id: agent.id }
    }
    const created = await db
        .from("agent_conversations")
        .insert({
            workspace_id: ws,
            agent_id: agent.id,
            kind: "customer",
            channel: ev.platform,
            external_id: externalId,
            visitor_name: name,
            connection_id: conn.id,
        })
        .select()
        .single()
    if (created.error) throw new Error(created.error.message)
    return created.data as AgentConversation
}

const handleLead = async (db: Db, conn: Conn, ev: MetaEvent, page: MetaPage | null): Promise<MetaResult> => {
    const ws = conn.workspaceId
    let lead: MetaLead | null = null
    if (page && ev.leadgen_id) {
        try {
            lead = await fetchLead(page, ev.leadgen_id)
        } catch (e) {
            // A refused token / permission will not heal by retrying: record the lead id so a person can fetch it, and tell the owner.
            if (
                e instanceof MetaGraphError &&
                (e.failure === "token" || e.failure === "permission" || e.failure === "not_found")
            ) {
                await db
                    .from("connections")
                    .update({
                        status: "error",
                        last_error: `Meta không cho đọc lead (${e.failure}). Kết nối lại Page để cấp quyền leads_retrieval.`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", conn.id)
            } else {
                throw e
            }
        }
    }
    const contact = lead?.phone ?? lead?.email ?? null
    const name = lead?.name ?? lead?.email ?? lead?.phone ?? FALLBACK_NAME.facebook
    const body = lead ? leadNeed(lead, ev) : `Facebook Lead Ads: lead ${ev.leadgen_id} (không đọc được nội dung)`
    const { event, duplicate } = await ingest(
        db,
        ws,
        {
            channel: "facebook",
            kind: "lead",
            origin: "live",
            sender_name: name,
            sender_contact: contact,
            body,
            amount_vnd: null,
            external_ref: ev.leadgen_id,
            event_id: `meta:${conn.id}:${ev.event_key}`,
        },
        (n) => `#${n}`,
    )
    // Stored by an earlier try that failed before it was dispatched (its receipt was released): dispatch it now.
    if (duplicate && event.status === "processed")
        return { event_key: ev.event_key, handled: false, reason: "duplicate" }
    await markReceived(db, conn.id, name, body)
    if (!lead) return { event_key: ev.event_key, handled: false, reason: "lead_unreadable" }

    // Who receives this lead source: the agents bound `lead_source` to the connection that may act (not read-only).
    const sources = await agentsFor(conn.id, "lead_source", { acting: true })
    if (sources.length === 0) return { event_key: ev.event_key, handled: false, reason: "no_agent" }
    const c: EngineCtx = { db, ws, actor: "Facebook Lead Ads", locale: LOCALE }
    const fields = {
        contact_name: name,
        company: "",
        need: leadNeed(lead, ev),
        contact,
        channel_label: "Facebook Lead Ads",
    }
    if (sources.some((s) => s.module === "lead_gen")) {
        // The lead_gen agent receives it (capture_lead); its own handoff_to_sales then reaches Sales as a typed command (classify_lead), see continueChain.
        await sendCommandItem(c, {
            from: "inbound",
            to: "lead_gen",
            command: "capture_lead",
            reason: "lead_ad",
            origin: "live",
            inboundEventId: event.id,
            dedupeKey: `capture_lead:inbound:${event.id}`,
            payload: {
                subject_type: "inbound",
                subject_id: event.id,
                ...fields,
                platform: "facebook",
                source_kind: "leadgen",
                form_id: ev.form_id ?? "",
                ad_id: ev.ad_id ?? "",
                leadgen_id: ev.leadgen_id ?? "",
                connection_id: conn.id,
                phone: lead.phone ?? "",
                email: lead.email ?? "",
                turn: `t:${ev.event_key}`,
                message_at: ev.timestamp,
                // the answers of the form (without the contact fields) are what the score reads
                text: Object.entries(lead.fields)
                    .filter(
                        ([k]) =>
                            ![
                                "full_name",
                                "name",
                                "first_name",
                                "last_name",
                                "phone_number",
                                "phone",
                                "email",
                            ].includes(k),
                    )
                    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                    .join("\n"),
            },
        })
    } else {
        // No lead_gen agent bound: Sales (bound `lead_source`) takes the lead through the usual hand-off.
        await runWork(c, {
            action: "handoff_lead",
            subject_type: "inbound",
            subject_id: event.id,
            inbound_event_id: event.id,
            origin: "live",
            dedupeKey: `handoff_lead:inbound:${event.id}`,
            seed: { fields },
        })
    }
    await markProcessed(db, event.id)
    drainAfter(c, 4)
    revalidatePath("/", "layout")
    return { event_key: ev.event_key, handled: true }
}

const handleChat = async (db: Db, conn: Conn, ev: MetaEvent, page: MetaPage | null): Promise<MetaResult> => {
    const ws = conn.workspaceId
    const platform = ev.platform
    const personId = ev.sender_psid ?? ev.sender_igsid
    let text = ev.text?.trim() ?? ""
    let name = ev.sender_name

    if (ev.kind === "mention" && !text && page && ev.comment_id) {
        const m = await fetchMention(page, ev.comment_id)
        text = m.text?.trim() ?? ""
        name = name ?? m.username
    }

    // The window / private reply opens now, before anything else can fail.
    if ((ev.kind === "dm" || ev.kind === "postback") && personId)
        await touchThread(conn.id, platform, personId, ev.timestamp)
    if ((ev.kind === "comment" || ev.kind === "mention") && ev.comment_id)
        await noteComment(conn.id, platform, ev.comment_id, ev.timestamp)

    // The lead_gen agent bound to this connection takes comments, mentions and the DMs of its leads (lead-flow-inbound.ts); else the chatbot front door.
    const leadGen = await leadGenFor(db, conn, ev)
    const agent = leadGen ? null : (await routeInbound(conn.id)).front
    const agentRow = agent
        ? ((((
              await db
                  .from("agents")
                  .select("*")
                  .eq("workspace_id", ws)
                  .in("module", [...INBOUND_MODULES])
                  .eq("id", agent.id)
                  .limit(1)
          ).data ?? [])[0] ?? null) as Agent | null)
        : null

    if (!name && personId && page && (ev.kind === "dm" || ev.kind === "postback")) {
        const known = ((
            await db
                .from("agent_conversations")
                .select("visitor_name")
                .eq("workspace_id", ws)
                .eq("channel", platform)
                .eq("external_id", personId)
                .maybeSingle()
        ).data ?? null) as { visitor_name: string | null } | null
        name = known?.visitor_name ?? (await fetchProfileName(page, platform, personId))
    }
    const shownName = name ?? FALLBACK_NAME[platform]
    const body = text || (ev.kind === "dm" ? "[tệp đính kèm]" : "")

    const { event, duplicate } = await ingest(
        db,
        ws,
        {
            channel: platform,
            kind: "message",
            origin: "live",
            sender_name: shownName,
            sender_contact: null,
            body,
            amount_vnd: null,
            external_ref: ev.comment_id ?? ev.mid ?? null,
            event_id: `meta:${conn.id}:${ev.event_key}`,
        },
        (n) => `#${n}`,
    )
    // Stored by an earlier try that failed before it was dispatched (its receipt was released): dispatch it now.
    if (duplicate && event.status === "processed")
        return { event_key: ev.event_key, handled: false, reason: "duplicate" }
    await markReceived(db, conn.id, shownName, body)

    if (leadGen) {
        await handleLeadGenEvent(db, ws, ev, {
            agent: leadGen,
            eventId: event.id,
            name: shownName,
            text,
            connectionId: conn.id,
        })
        await markProcessed(db, event.id)
        revalidatePath("/", "layout")
        return { event_key: ev.event_key, handled: true }
    }
    if (!agentRow) return { event_key: ev.event_key, handled: false, reason: "no_agent" }
    if (!text) return { event_key: ev.event_key, handled: false, reason: "no_text" }

    const conv = await conversationFor(db, ws, conn, ev, agentRow, shownName)
    await customerTurn({ db, ws, actor: ACTOR[platform], locale: LOCALE }, conv, agentRow, text, {
        channel: LABEL[platform],
        eventId: `meta:${ev.event_key}`,
    })
    await markProcessed(db, event.id)
    revalidatePath("/", "layout")
    return { event_key: ev.event_key, handled: true }
}

/**
 * Store and dispatch the events of one webhook delivery. An event whose Page is not connected is ignored. An exception (database down,
 * Meta unreachable while reading a lead) releases that event's receipt and is rethrown, so the route answers 500 and Meta redelivers it;
 * events already done are not repeated (their receipts and event ids hold).
 */
export const handleMetaEvents = async (events: ReadonlyArray<MetaEvent>): Promise<Array<MetaResult>> => {
    const db = supabaseAdmin()
    const conns = new Map<string, Conn | null>()
    const pages = new Map<string, MetaPage | null>()
    const results: Array<MetaResult> = []
    for (const ev of events) {
        const ownerKey = `${ev.platform}:${ev.platform === "facebook" ? ev.page_id : ev.ig_id}`
        if (!conns.has(ownerKey)) conns.set(ownerKey, await findMetaConnection(db, ev))
        const conn = conns.get(ownerKey) ?? null
        if (!conn) {
            results.push({ event_key: ev.event_key, handled: false, reason: "no_connection" })
            continue
        }
        const receipt = `${conn.id}:${ev.event_key}`
        if (!(await claim(db, conn.workspaceId, receipt))) {
            results.push({ event_key: ev.event_key, handled: false, reason: "duplicate" })
            continue
        }
        try {
            if (!pages.has(conn.id)) pages.set(conn.id, await loadMetaPage(conn.id).catch(() => null))
            const page = pages.get(conn.id) ?? null
            results.push(
                ev.kind === "leadgen" ? await handleLead(db, conn, ev, page) : await handleChat(db, conn, ev, page),
            )
        } catch (e) {
            await release(db, conn.workspaceId, receipt).catch(() => null)
            console.error("meta webhook event failed", ev.kind, e instanceof Error ? e.message : e)
            throw e
        }
    }
    return results
}

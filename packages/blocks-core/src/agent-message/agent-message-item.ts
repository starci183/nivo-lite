import { z } from "zod"
import {
    AGENT_MESSAGE_STATES,
    agentMessageKindOf,
    type AgentMessageKind,
    type AgentMessageState,
} from "@nivo-lite/agent-sdk/team-chat"

/** The intents a message may have. They are apart from the kind: one agent can send any kind with any intent, and only `ask` and `approve` wait for a person. */
export const AGENT_MESSAGE_INTENTS = ["notify", "ask", "approve", "report"] as const

/** One of the intents a message may have. */
export type AgentMessageIntent = (typeof AGENT_MESSAGE_INTENTS)[number]

/** One agent message as the shell draws it: the envelope (which agent, to whom, when, about which work, in which state) and a payload of a registered kind. */
export interface AgentMessageRecord {
    /** The message; the key every action on it carries. */
    readonly id: string
    /** The content kind, registered by a module: `message.text`, `document.invoice`, `report.daily`... */
    readonly kind: string
    /** What the message is for. */
    readonly intent: AgentMessageIntent
    /** The state of a message that asks for something; none for a notice or a report. */
    readonly state?: AgentMessageState | undefined
    /** The agent that sent it, by name. */
    readonly agent: string
    /** Who it is for: the owner, the team, or a name; in words. */
    readonly to: string
    /** When it was sent, in words. */
    readonly at: string
    /** The related work or run, with where it opens. */
    readonly work?: { readonly label: string; readonly href: string } | undefined
    /** When the agent wants to send something to a customer, who gets it and through which connection; the payload is that content. */
    readonly outbound?:
        | { readonly to: string; readonly via?: { readonly provider: string; readonly label: string } | undefined }
        | undefined
    /** The level the action needs, in words. */
    readonly level: string
    /** The heading of the card. */
    readonly title: string
    /** The line drawn for a kind nobody registered. */
    readonly summary: string
    /** The payload; its shape is the schema of its kind. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The answers an `ask` offers. */
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    /** Why a person is asked: the evidence and the rule behind it. */
    readonly why: ReadonlyArray<{
        readonly source: "evidence" | "rule"
        readonly label: string
        readonly quote: string
    }>
    /** Where the source record opens, for a kind changed at its source and for the unknown kind. */
    readonly detailHref: string
    /** A line of guidance, or why it failed. */
    readonly note: string
}

const T = 300

/** The record a spec binds to the message slot, as the schema reads it. */
const agentMessageRecordSchema: z.ZodType<AgentMessageRecord> = z.object({
    id: z.string().min(1).max(T),
    kind: z.string().min(1).max(T),
    intent: z.enum(AGENT_MESSAGE_INTENTS).default("notify"),
    state: z.enum(AGENT_MESSAGE_STATES).optional(),
    agent: z.string().max(T).default(""),
    to: z.string().max(T).default(""),
    at: z.string().max(T).default(""),
    work: z.object({ label: z.string().max(T), href: z.string().max(T).default("") }).optional(),
    outbound: z
        .object({
            to: z.string().max(T),
            via: z.object({ provider: z.string().max(T), label: z.string().max(T) }).optional(),
        })
        .optional(),
    level: z.string().max(T).default(""),
    title: z.string().max(T).default(""),
    summary: z.string().max(T).default(""),
    payload: z.looseObject({}).default({}),
    options: z
        .array(z.object({ id: z.string().min(1).max(T), label: z.string().max(T) }))
        .max(8)
        .default([]),
    why: z
        .array(
            z.object({
                source: z.enum(["evidence", "rule"]),
                label: z.string().max(T),
                quote: z.string().max(T).default(""),
            }),
        )
        .max(20)
        .default([]),
    detailHref: z.string().max(T).default(""),
    note: z.string().max(T).default(""),
})

/** A message, with the kind it names when the registry knows it and its payload when it fits that kind. */
export interface AgentMessageItem {
    /** The message. */
    readonly record: AgentMessageRecord
    /** Its kind, or none when the registry does not hold it or the payload does not fit: the shell then draws a summary and the way to open it. */
    readonly kind: AgentMessageKind | undefined
    /** The payload when it parses under the kind, else nothing. */
    readonly payload: unknown
    /** The intent. */
    /** What the message is for. */
    readonly intent: AgentMessageIntent
    /** The state of a message that asks for something: waiting unless the record says otherwise; none for a notice or a report. */
    readonly state: AgentMessageState | null
    /** Whether the message still waits for a person: what the desk and the inbox list. */
    readonly isOpen: boolean
}

const asks = (intent: AgentMessageIntent): boolean => intent === "ask" || intent === "approve"

/** The message in a bound record: nothing when the record is not one. */
export const agentMessageItemOf = (
    record: unknown,
    kinds: ReadonlyArray<AgentMessageKind>,
): AgentMessageItem | null => {
    const parsed = agentMessageRecordSchema.safeParse(record)
    if (!parsed.success) return null
    const kind = agentMessageKindOf(kinds, parsed.data.kind)
    const payload = kind === undefined ? undefined : kind.payload.safeParse(parsed.data.payload)
    const state = asks(parsed.data.intent) ? (parsed.data.state ?? "waiting") : null
    return {
        record: parsed.data,
        kind: payload?.success === true ? kind : undefined,
        payload: payload?.success === true ? payload.data : undefined,
        intent: parsed.data.intent,
        state,
        isOpen: state === "waiting",
    }
}

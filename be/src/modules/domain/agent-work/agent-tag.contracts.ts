import type { AgentLocale } from "./agent-work.contracts"

/** The plain data a tag hands to its target's graph: a JSON object of any shape the tagger chooses. */
export interface AgentTagPayload {
    readonly [key: string]: unknown
}

/** What a tag is about, whoever tags: the words, and the record or conversation it concerns. */
export interface AgentTagBody {
    /** The workspace of both agents. */
    readonly workspaceId: string
    /** The agent that is tagged; its graph starts at its tag trigger. */
    readonly toAgentId: string
    /** What the tagger says to it. */
    readonly text: string
    /** The record the tag is about, when it is about one. */
    readonly subject?: string | null | undefined
    /** The conversation the tag belongs to, when it belongs to one. */
    readonly conversationId?: string | null | undefined
    /** The channel of that conversation, when known. */
    readonly channel?: string | null | undefined
    /** The customer the tag is about, when known. */
    readonly leadId?: string | null | undefined
    /** The language the target answers in; vi when absent. */
    readonly locale?: AgentLocale | undefined
    /** Plain data for the target's graph (objects and arrays allowed): it becomes trigger.context there. Kept as JSON text, at most 8000 characters. */
    readonly context?: AgentTagPayload | undefined
    /** Stable for one fact, so the same tag written twice wakes once; a fresh key per call when absent. */
    readonly eventKey?: string | undefined
}

/** Tagged by another agent, at the end of its graph: the right to tag comes from the lists of the agents. */
export interface AgentTaggedByAgent extends AgentTagBody {
    /** The agent that tags. */
    readonly fromAgentId: string
}

/** Tagged by a person, for example with an @ in a group chat: the caller has proved the person may hand work to the agent. */
export interface AgentTaggedByPerson extends AgentTagBody {
    /** The member (workspace_members.id) that tags. */
    readonly personId: string
}

/** Tagged by the system, for example by an event or a feed: the source names what started it. */
export interface AgentTaggedBySource extends AgentTagBody {
    /** What started the tag, in a few words. */
    readonly source: string
}

/** Who or what a tag wake names as its writer, told by which field is present: what `tagContextOf` reads into a wake's context. */
export type AgentTagRequest = AgentTaggedByAgent | AgentTaggedByPerson | AgentTaggedBySource

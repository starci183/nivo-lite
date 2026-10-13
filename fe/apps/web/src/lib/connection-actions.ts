"use server"

import { getTranslations } from "next-intl/server"
import { writeAgentConnections } from "@/modules/api/connections/write-agent-connections"
import { writeCheck } from "@/modules/api/connections/write-check"
import { writeConnectionAgents } from "@/modules/api/connections/write-connection-agents"
import { writeFirstEvent } from "@/modules/api/connections/write-first-event"
import { writeGrant } from "@/modules/api/connections/write-grant"
import type { Outcome as ApiOutcome } from "@/modules/api/outcome"
import type { Access, ConnectionCheck, FirstEventState } from "@/modules/types"
import { getCurrentMember } from "./members"
import type { Outcome } from "./types"

/**
 * Compatibility wrappers for the lanes that still call the old connection server actions (the agent settings card, the data wizards,
 * the Meta and Telegram wizards). Each one reads the workspace of the signed-in member, calls the typed write in
 * `modules/db/connections` (which goes through the api, where the role is checked) and answers the old `Outcome` with the sentence
 * in the reader's language. Wave 3 deletes this file when its callers use the writes from their own connected blocks.
 */
export type { ConnectionCheck, FirstEventState }

/** A failed write carries the catalog key of its sentence in `code`; this reads it in the language of the request. */
const sentenceOf = async <T>(outcome: ApiOutcome<T>): Promise<Outcome<T>> => {
    if (outcome.kind === "ok") return { ok: true, data: outcome.value }
    const t = await getTranslations("connections")
    return { ok: false, error: t(outcome.fault.code, { agent: "", connection: "" }) }
}

/** One agent's access to one connection (null removes it). Saved at once from either picker. */
export const setGrant = async (
    connectionId: string,
    agentId: string,
    access: Access | null,
): Promise<Outcome<true>> => {
    const me = await getCurrentMember()
    return sentenceOf(await writeGrant({ workspaceId: me.workspaceId, connectionId, agentId, access }))
}

type ByAgent = string | { readonly agentId: string; readonly access: Access }
type ByConnection = string | { readonly connectionId: string; readonly access: Access }

/** Exactly these agents use this connection (wizards' last step). A bare id keeps that agent's current level, or starts at "ask". */
export const setConnectionAgents = async (
    connectionId: string,
    wanted: ReadonlyArray<ByAgent>,
): Promise<Outcome<true>> => {
    const me = await getCurrentMember()
    return sentenceOf(await writeConnectionAgents({ workspaceId: me.workspaceId, connectionId, agents: wanted }))
}

/** Exactly these connections are used by this agent (the agent's settings). Same rules as setConnectionAgents, the other way. */
export const setAgentConnections = async (
    agentId: string,
    wanted: ReadonlyArray<ByConnection>,
): Promise<Outcome<true>> => {
    const me = await getCurrentMember()
    return sentenceOf(await writeAgentConnections({ workspaceId: me.workspaceId, agentId, connections: wanted }))
}

/** The wizard asks every 3 seconds: has the first webhook arrived for this connection? */
export const checkFirstEvent = async (connectionId: string): Promise<Outcome<FirstEventState>> => {
    const me = await getCurrentMember()
    return sentenceOf(await writeFirstEvent({ workspaceId: me.workspaceId, connectionId }))
}

/** Ask the provider what it knows (Telegram: getMe + getWebhookInfo, pending updates and the last delivery error). */
export const testConnection = async (connectionId: string): Promise<Outcome<ConnectionCheck>> => {
    const me = await getCurrentMember()
    return sentenceOf(await writeCheck({ workspaceId: me.workspaceId, connectionId }))
}

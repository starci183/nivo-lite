import { z } from "zod"
import { LIST_ROWS_MAX } from "@modules/platform/database"

/** An id as an agent op names it (a uuid is 36; an engine key is bounded at 200 by the ops that take one). */
const ID_MAX = 200

/** The ids an agent op names, as they are read from its validated arguments. */
export interface NamedIds {
    /** The installation the op names, when it does. */
    readonly installationId?: string | undefined
    /** The run the op names, when it does. */
    readonly runId?: string | undefined
}

/** The ids an agent op names, read from its validated arguments. */
export const namedIdsSchema: z.ZodType<NamedIds> = z.looseObject({
    installationId: z.string().max(ID_MAX).optional(),
    runId: z.string().max(ID_MAX).optional(),
})

/** One agent entry of an answer: the agent it belongs to, whatever else it carries. */
export interface AgentEntry {
    /** The members the answer carries beside the agent. */
    readonly [member: string]: unknown
    /** The agent the entry belongs to; null for an entry of none. */
    readonly agentId: string | null
}

/** An answer that lists agents (a scoped key sees its own agent's only). */
export interface AgentsAnswer {
    /** The members the answer carries beside the agents. */
    readonly [member: string]: unknown
    /** The agents. */
    readonly agents: ReadonlyArray<AgentEntry>
}

/** One stop of an answer: the agent it belongs to, whatever else it carries. */
export interface StopEntry {
    /** The members the stop carries beside the agent. */
    readonly [member: string]: unknown
    /** The agent the stop belongs to. */
    readonly agentId: string
}

/** An answer that pages stops (a scoped key sees its own agent's only; the page then carries no workspace total). */
export interface StopsAnswer {
    /** The members the page carries beside the stops. */
    readonly [member: string]: unknown
    /** The stops. */
    readonly stops: ReadonlyArray<StopEntry>
    /** How many stops stand open in the workspace; absent for a scoped key. */
    readonly total?: number | undefined
}

/** The agents an answer lists. */
export const agentsAnswerSchema: z.ZodType<AgentsAnswer> = z.looseObject({
    agents: z.array(z.looseObject({ agentId: z.string().max(ID_MAX).nullable() })).max(LIST_ROWS_MAX),
})

/** The stops an answer pages. */
export const stopsAnswerSchema: z.ZodType<StopsAnswer> = z.looseObject({
    stops: z.array(z.looseObject({ agentId: z.string().max(ID_MAX) })).max(LIST_ROWS_MAX),
    total: z.number().optional(),
})

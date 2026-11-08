import { eachInOrder } from "@modules/platform/primitives"
import {
    doorPort,
    defineJob,
    type DoorApi,
    type JobDefinition,
    type MutationResult,
    type MutationValues,
} from "@nivo-lite/agent-sdk/mutation"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import { HISTORY_OUTPUT_SCHEMA, SYNC_AGENT_TURNS_INPUT } from "./agent-turn-sync.schema"
import { EntityEngineDoorError, EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

/** The entity the turns are copied into, declared in blocks-core. */
const TURN_ENTITY = "agent.turn"

/** The unique constraint of the entity that a turn is written under: the same session and index is the same record. */
const TURN_KEY = "session_turn_key"

/** The part of the engine data port the sync uses: write one record, or update the one a declared unique constraint names. */
export interface TurnWriter {
    /** Inserts the record, or updates the one the constraint names. */
    upsert(entity: string, on: string, values: MutationValues): Promise<MutationResult<unknown>>
}

/** The engine data port as the sync job asks for it. */
export const turnWriterPort: PortDefinition<TurnWriter> = definePort<TurnWriter>("engine.entities")

/** The agent and session whose turns are copied. */
export interface SyncInput {
    /** The module key of the agent. */
    readonly agentKey: string
    /** The session key. */
    readonly sessionKey: string
}

/** The ports of the sync job. */
export interface SyncPorts {
    /** The NIVO MCP door. */
    readonly door: DoorApi
    /** The engine data port. */
    readonly entities: TurnWriter
}

/** The refusal that makes the queue try the sync again. */
const failed = (reason: string): EntityEngineDoorError =>
    new EntityEngineDoorError({ code: EntityEngineDoorErrorCode.SyncFailed, params: { reason } })

/**
 * Copies the turns of one agent session into the `agent.turn` records of the workspace: reads them through the door tool
 * `ai.agent.history`, then writes each under the unique (session, index) constraint, so running the sync again updates the same records
 * and never adds a second. A failure of the door or of a write is thrown; the queue retries the job, and the records already written
 * stay as they are.
 */
export const syncAgentTurns = async (ports: SyncPorts, input: SyncInput): Promise<void> => {
    const answer = await ports.door.call("ai.agent.history", { agentKey: input.agentKey, sessionKey: input.sessionKey })
    if (!answer.ok) throw failed(answer.reason)
    const history = HISTORY_OUTPUT_SCHEMA.safeParse(answer.output)
    if (!history.success) throw failed("history_unreadable")
    await eachInOrder(history.data.turns, async (turn) => {
        const written = await ports.entities.upsert(TURN_ENTITY, TURN_KEY, {
            agentKey: input.agentKey,
            sessionKey: input.sessionKey,
            turnIndex: turn.index,
            role: turn.role,
            text: turn.text,
            toolCalls: { calls: turn.toolCalls.map((call) => ({ name: call.name, argsJson: call.argsJson })) },
            at: turn.at,
        })
        if (!written.ok) throw failed(written.reason)
    })
}

/** The declared sync job: whoever knows a session has new turns enqueues it with the agent and session keys. */
export const syncAgentTurnsJob: JobDefinition = defineJob({
    name: "agent.sync-turns",
    input: SYNC_AGENT_TURNS_INPUT,
    ports: { door: doorPort, entities: turnWriterPort },
    attempts: 5,
    run: (ports, input) => syncAgentTurns(ports, input),
})

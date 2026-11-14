import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"

/** What removing an agent takes from the records store: its records per declared type, and the files they hold. */
export interface AgentRecordsFootprint {
    /** The record types the agent owns records of, with how many (most first). */
    readonly types: ReadonlyArray<{ readonly type: string; readonly count: number }>
    /** Every record of the agent. */
    readonly records: number
    /** Every file the records hold. */
    readonly files: number
}

/** What erasing an agent's records came to: how many went, and the object keys of their files (to remove once the caller committed). */
export interface AgentRecordsErasure {
    /** Records removed. */
    readonly records: number
    /** The object keys of the files the removed records held. */
    readonly files: ReadonlyArray<string>
}

/**
 * The boundary between an agent and its records (records.md: an agent's records die with it): the records store implements this port
 * (record-files), so the modules never read the records' tables. Optional: with no implementation bound, an agent has no records.
 */
export interface AgentRecordsPort {
    /** The counts the deletion warning shows. */
    footprintOf(workspaceId: string, agentId: string): Promise<AgentRecordsFootprint>
    /**
     * Erases every record of the agent in the caller's own transaction `manager` (so they go with the removal or not at all), links
     * included; answers the object keys of the files, for `removeFiles` once the caller committed.
     */
    erase(workspaceId: string, agentId: string, manager: EntityManager): Promise<AgentRecordsErasure>
    /** Removes the objects from the bucket (a database cascade or an erase never does); an object the store cannot remove is kept and logged. */
    removeFiles(keys: ReadonlyArray<string>): Promise<void>
}

/** The injection token of the records of an agent. */
export const AGENT_RECORDS: unique symbol = Symbol("AGENT_RECORDS")

/** Injects the records of an agent. Parameter type: AgentRecordsPort. */
export const InjectAgentRecords = (): TypedParameterDecorator<AgentRecordsPort> => injector<AgentRecordsPort>(AGENT_RECORDS)

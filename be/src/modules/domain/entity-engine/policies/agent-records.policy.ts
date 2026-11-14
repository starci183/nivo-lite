import { In, IsNull } from "typeorm"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { eachInOrder } from "@modules/platform/primitives"
import { RecordEntity } from "../persistence/entities"
import type { EntityCatalog } from "./compiler.contracts"
import { filesOf } from "./contact-values.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** The live records of one type an agent owns: their ids. */
export interface AgentRecordSet {
    /** The record type. */
    readonly entity: string
    /** The record ids. */
    readonly ids: ReadonlyArray<string>
}

/** The most ids one statement names. */
const CHUNK = 500

const chunksOf = (ids: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<string>> =>
    Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, index) => ids.slice(index * CHUNK, (index + 1) * CHUNK))

/**
 * Every LIVE record of the scope's workspace that the agent owns (its `agent_id`), by declared type: what is soft-deleted with the agent. The scope may see every record (`all`); the agent is named in the read, never taken from the scope.
 * Types the agent has no record of are left out.
 */
export const recordsOfAgent = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    agentId: string,
): Promise<ReadonlyArray<AgentRecordSet>> => {
    const sets: Array<AgentRecordSet> = []
    await eachInOrder([...catalog.values()], async (entity) => {
        const rows = await tx.manager.find(RecordEntity, { where: { entity: entity.name, workspaceId: tx.workspaceId, agentId } })
        if (rows.length === 0) return
        sets.push({ entity: entity.name, ids: rows.map((row) => row.id) })
    })
    return sets
}

/**
 * The object keys of the files the agent's records of one type hold (the data column alone is read); none for a type with no file field.
 * What the deletion warning counts, without reading every record of the agent.
 */
export const fileKeysOfAgent = async (tx: ScopedTx, entity: EntityDefinition, agentId: string): Promise<ReadonlyArray<string>> => {
    if (!Object.values(entity.fields).some((field) => field.kind === "file")) return []
    const rows = await tx.manager.find(RecordEntity, {
        select: { id: true, data: true },
        where: { entity: entity.name, workspaceId: tx.workspaceId, agentId },
    })
    return rows.flatMap((row) => filesOf(entity, row.data))
}

/**
 * SOFT-deletes the records of the sets (owner order 2026-11-14: nothing is hard-deleted): one UPDATE per chunk of ids sets `deleted_at`
 * and bumps `version`. Their links stay (hidden with them), their files stay, and the agent's row is not touched. A record already deleted
 * is not matched again. Answers how many records were deleted.
 */
export const softDeleteAgentRecords = async (tx: ScopedTx, sets: ReadonlyArray<AgentRecordSet>): Promise<number> => {
    const workspaceId = tx.workspaceId
    let deleted = 0
    await eachInOrder(sets, async ({ entity, ids }) => {
        await eachInOrder(chunksOf(ids), async (chunk) => {
            const result = await tx.manager
                .createQueryBuilder(RecordEntity, "r")
                .update(RecordEntity)
                .set({ deletedAt: () => "now()", version: () => "version + 1" })
                .where({ entity, workspaceId, id: In([...chunk]), deletedAt: IsNull() })
                .execute()
            deleted += result.affected ?? 0
        })
    })
    return deleted
}

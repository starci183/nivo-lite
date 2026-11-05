import type { EntityManager } from "typeorm"
import { entityEngineEntities } from "@modules/domain/entity-engine"

const [RecordEntity, RecordLinkEntity, EntitySequenceEntity] = entityEngineEntities

/** The declared fields a proof writes: scalars only. */
export type RecordData = Record<string, string | number | boolean | null>

/** One end of a link: the entity and the id of a record. */
export interface RecordRef {
    readonly entity: string
    readonly id: string
}

/** The key of one counter. */
export interface CounterKey {
    readonly workspaceId: string
    readonly entity: string
    readonly field: string
    readonly period: string
}

/** Inserts a record through its entity, on the connection (and so the scope) of the manager. */
export const insertRecord = async (
    manager: EntityManager,
    entity: string,
    id: string,
    workspaceId: string,
    data: RecordData,
): Promise<void> => {
    await manager.save(RecordEntity, { entity, id, workspaceId, data })
}

/** Links two records of a workspace under a relation. */
export const linkRecords = async (
    manager: EntityManager,
    workspaceId: string,
    from: RecordRef,
    relation: string,
    to: RecordRef,
): Promise<void> => {
    await manager.insert(RecordLinkEntity, {
        workspaceId,
        fromEntity: from.entity,
        fromId: from.id,
        relation,
        toEntity: to.entity,
        toId: to.id,
    })
}

/** Creates a counter and fails on a duplicate; the value may be named. */
export const insertCounter = async (manager: EntityManager, key: CounterKey, value?: string): Promise<void> => {
    await manager.insert(EntitySequenceEntity, value === undefined ? key : { ...key, value })
}

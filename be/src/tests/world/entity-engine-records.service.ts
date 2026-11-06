import type { EntityManager } from "typeorm"
import { entityEngineEntities } from "@modules/domain/entity-engine"
import type { CounterKey, RecordData } from "../fixtures/builders/entity-engine-writes.builder"

const [RecordEntity, RecordLinkEntity, EntitySequenceEntity] = entityEngineEntities

/** The entity the proofs write: a declared flow-F entity with a real partition. */
export const LEAD_ENTITY = "sales.lead"

/** The most rows one proof reads back. */
const ROWS_MAX = 100

/** The declared fields a sales.lead needs to satisfy the partition's CHECKs. */
export const leadData = (contactName: string, extra: Readonly<RecordData> = {}): RecordData => ({
    contactName,
    channel: "zalo",
    stage: "new",
    ...extra,
})

/** Moves a record to another workspace; answers how many rows the statement touched. */
export const moveRecord = async (
    manager: EntityManager,
    entity: string,
    id: string,
    workspaceId: string,
): Promise<number> => (await manager.update(RecordEntity, { entity, id }, { workspaceId })).affected ?? 0

/** Changes a record when the caller still holds its version; answers how many rows were changed. */
export const changeRecord = async (
    manager: EntityManager,
    entity: string,
    id: string,
    version: string,
    data: Record<string, unknown>,
): Promise<number> =>
    (
        await manager
            .createQueryBuilder()
            .update(RecordEntity)
            .set({ data: () => "CAST(:data AS jsonb)", version: () => "version + 1" })
            .where({ entity, id, version })
            .setParameter("data", JSON.stringify(data))
            .execute()
    ).affected ?? 0

/** Deletes a record; answers how many rows were deleted. */
export const removeRecord = async (manager: EntityManager, entity: string, id: string): Promise<number> =>
    (await manager.delete(RecordEntity, { entity, id })).affected ?? 0

/** The version of a record, or null when it is not visible. */
export const versionOf = async (manager: EntityManager, entity: string, id: string): Promise<string | null> =>
    (await manager.findOneBy(RecordEntity, { entity, id }))?.version ?? null

/** The workspace of every record visible to the connection, with no WHERE: the deliberately broken read RLS must still contain. */
export const visibleRecordWorkspaces = async (manager: EntityManager): Promise<Array<string>> =>
    (await manager.find(RecordEntity, { take: ROWS_MAX })).map((record) => record.workspaceId)

/** How many records of a workspace the connection sees when it asks for that workspace by name. */
export const recordsOfWorkspace = (manager: EntityManager, workspaceId: string): Promise<number> =>
    manager.countBy(RecordEntity, { workspaceId })

/** Removes the links that start at a record; answers how many were removed. */
export const unlinkFrom = async (manager: EntityManager, entity: string, id: string): Promise<number> =>
    (await manager.delete(RecordLinkEntity, { fromEntity: entity, fromId: id })).affected ?? 0

/** Creates a counter at zero, or leaves an existing one alone (a second first use). */
export const ensureCounter = async (manager: EntityManager, key: CounterKey): Promise<void> => {
    await manager.createQueryBuilder().insert().into(EntitySequenceEntity).values(key).orIgnore().execute()
}

/** Takes the next number of a counter, atomically, in the transaction of the manager; null when the counter is not visible. */
export const nextNumber = async (manager: EntityManager, key: CounterKey): Promise<string | null> => {
    const result = await manager
        .createQueryBuilder()
        .update(EntitySequenceEntity)
        .set({ value: () => "value + 1" })
        .where("workspace_id = :workspaceId AND entity = :entity AND field = :field AND period = :period", key)
        .returning("value")
        .execute()
    const raw: unknown = result.raw
    if (!Array.isArray(raw)) return null
    const row: unknown = raw[0]
    if (typeof row !== "object" || row === null || !("value" in row)) return null
    return typeof row.value === "string" ? row.value : null
}

/** The value of a counter, or null when it is not visible. */
export const counterValue = async (manager: EntityManager, key: CounterKey): Promise<string | null> =>
    (await manager.findOneBy(EntitySequenceEntity, key))?.value ?? null

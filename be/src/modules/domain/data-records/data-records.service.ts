import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { DataEntity, DataRecordInput } from "./data-records.contracts"
import type { DataCountRow } from "./persistence/data-records.rows"
import { COUNT_DATA_RECORDS, COUNT_EXISTING_DATA_RECORDS, UPSERT_DATA_RECORDS } from "./persistence/data-records.sql"

const BATCH = 500
const ID_MAX = 300
const TITLE_MAX = 300

const batchesOf = <T>(items: ReadonlyArray<T>): ReadonlyArray<ReadonlyArray<T>> =>
    Array.from({ length: Math.ceil(items.length / BATCH) }, (_unused, index) => items.slice(index * BATCH, (index + 1) * BATCH))

@Injectable()
/** The rows the owner's own systems put in the hub: one per connection, entity and source id, so a re-sync updates instead of duplicating. */
export class DataRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Upserts rows of one entity for one connection in batches; answers how many were written (rows with no usable id are skipped). */
    async upsert(
        workspaceId: string,
        connectionId: string,
        entity: DataEntity,
        rows: ReadonlyArray<DataRecordInput>,
    ): Promise<number> {
        const usable = rows.filter((row) => row.externalId !== "" && String(row.externalId).length <= ID_MAX)
        await eachInOrder(batchesOf(usable), async (batch) => {
            const chunk = batch.map((row) => ({
                external_id: String(row.externalId),
                title: (row.title ?? "").slice(0, TITLE_MAX),
                occurred_at:
                    row.occurredAt === undefined || row.occurredAt === null
                        ? null
                        : new Date(row.occurredAt).toISOString(),
                data: row.data,
            }))
            await this.entityManager.query(UPSERT_DATA_RECORDS, [
                workspaceId,
                connectionId,
                entity,
                JSON.stringify(chunk),
            ])
        })
        return usable.length
    }

    /** How many of these source ids the connection already holds for the entity (what a re-import will update). */
    async countExisting(connectionId: string, entity: DataEntity, externalIds: ReadonlyArray<string>): Promise<number> {
        const counts = await Promise.all(
            batchesOf(externalIds).map((ids) =>
                this.entityManager.query<Array<DataCountRow>>(COUNT_EXISTING_DATA_RECORDS, [connectionId, entity, ids]),
            ),
        )
        return counts.reduce((total, [row]) => total + (row?.n ?? 0), 0)
    }

    /** How many rows the connection holds in the hub. */
    async count(connectionId: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<DataCountRow>>(COUNT_DATA_RECORDS, [connectionId])
        return row?.n ?? 0
    }
}

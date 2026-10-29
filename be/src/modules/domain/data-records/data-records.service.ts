import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { DataEntity, DataRecordInput } from "./data-records.contracts"
import { DataRecordEntity } from "./persistence/entities"

const BATCH = 500
const ID_MAX = 300
const TITLE_MAX = 300

const batchesOf = <T>(items: ReadonlyArray<T>): ReadonlyArray<ReadonlyArray<T>> =>
    Array.from({ length: Math.ceil(items.length / BATCH) }, (_unused, index) =>
        items.slice(index * BATCH, (index + 1) * BATCH),
    )

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
                workspaceId,
                connectionId,
                entity,
                externalId: String(row.externalId),
                title: (row.title ?? "").slice(0, TITLE_MAX),
                occurredAt:
                    row.occurredAt === undefined || row.occurredAt === null
                        ? null
                        : new Date(new Date(row.occurredAt).toISOString()),
                data: { ...row.data },
                syncedAt: () => "now()",
            }))
            await this.entityManager.upsert(DataRecordEntity, chunk, ["connectionId", "entity", "externalId"])
        })
        return usable.length
    }

    /** How many of these source ids the connection already holds for the entity (what a re-import will update). One statement: the ids travel as a single array parameter. */
    countExisting(connectionId: string, entity: DataEntity, externalIds: ReadonlyArray<string>): Promise<number> {
        if (externalIds.length === 0) return Promise.resolve(0)
        return this.entityManager
            .createQueryBuilder(DataRecordEntity, "d")
            .where("d.connection_id = :connectionId AND d.entity = :entity", { connectionId, entity })
            .andWhere("d.external_id = ANY(:ids)", { ids: [...externalIds] })
            .getCount()
    }

    /** How many rows the connection holds in the hub. */
    count(connectionId: string): Promise<number> {
        return this.entityManager.count(DataRecordEntity, { where: { connectionId } })
    }
}

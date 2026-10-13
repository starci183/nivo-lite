import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DataEntity, DataRecordInput } from "./data-hub.contracts"
import type { DataCountRow } from "./persistence/data-hub.rows"
import { COUNT_DATA_RECORDS, COUNT_EXISTING_DATA_RECORDS, UPSERT_DATA_RECORDS } from "./persistence/data-hub.sql"

const BATCH = 500
const ID_MAX = 300
const TITLE_MAX = 300

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
        let written = 0
        for (let from = 0; from < usable.length; from += BATCH) {
            const chunk = usable.slice(from, from + BATCH).map((row) => ({
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
            written += chunk.length
        }
        return written
    }

    /** How many of these source ids the connection already holds for the entity (what a re-import will update). */
    async countExisting(connectionId: string, entity: DataEntity, externalIds: ReadonlyArray<string>): Promise<number> {
        let found = 0
        for (let from = 0; from < externalIds.length; from += BATCH) {
            const [row] = await this.entityManager.query<Array<DataCountRow>>(COUNT_EXISTING_DATA_RECORDS, [
                connectionId,
                entity,
                externalIds.slice(from, from + BATCH),
            ])
            found += row?.n ?? 0
        }
        return found
    }

    /** How many rows the connection holds in the hub. */
    async count(connectionId: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<DataCountRow>>(COUNT_DATA_RECORDS, [connectionId])
        return row?.n ?? 0
    }
}

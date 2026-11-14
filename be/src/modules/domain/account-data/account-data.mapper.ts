import type { StoredRow } from "./account-data.contracts"
import { valueOf } from "./account-data.policy"
import type { AccountDataEntity } from "./persistence/entities"

/** A stored row as a reader gets it. */
export const storedRowOf = (row: AccountDataEntity): StoredRow => ({
    id: row.id,
    type: row.type,
    typeVersion: row.typeVersion,
    key: row.key,
    value: valueOf(row.value),
    occurredAt: row.occurredAt,
    processedAt: row.processedAt,
})

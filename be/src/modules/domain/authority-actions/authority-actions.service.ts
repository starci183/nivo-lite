import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AuthorityActionRecord, AuthorityActionsSyncReport } from "./authority-actions.contracts"
import { AuthorityActionEntity } from "./persistence/entities"

/** The most action rows one read or sync holds. */
const ACTION_LIMIT = 500

@Injectable()
/** The authority action rows, written through the transaction the catalogue sync hands in. */
export class AuthorityActionsService {
    /** Upserts the records in the caller's transaction and reports the rows it did not write; nothing is deleted. */
    async upsertAll(
        manager: EntityManager,
        records: ReadonlyArray<AuthorityActionRecord>,
    ): Promise<AuthorityActionsSyncReport> {
        const written =
            records.length === 0
                ? 0
                : (
                      await manager.upsert(
                          AuthorityActionEntity,
                          records.map((record) => ({
                              action: record.action,
                              moduleKey: record.module_key,
                              sortOrder: record.sort_order,
                              defaultMode: record.default_mode,
                              defaultLimitVnd:
                                  record.default_limit_vnd === null ? null : String(record.default_limit_vnd),
                              defaultRequiredFields: [...record.default_required_fields],
                              amountLimit: record.amount_limit,
                              maxMode: record.max_mode,
                              label: record.label,
                          })),
                          ["action"],
                      )
                  ).identifiers.length
        const held = await manager.find(AuthorityActionEntity, {
            select: { action: true },
            order: { action: "ASC" },
            take: ACTION_LIMIT,
        })
        const keys = new Set(records.map((record) => record.action))
        return { written, stale: held.map((row) => row.action).filter((action) => !keys.has(action)) }
    }

    /** Whether the catalogue holds the action, read through the manager the caller hands in. */
    exists(manager: EntityManager, action: string): Promise<boolean> {
        return manager.exists(AuthorityActionEntity, { where: { action } })
    }

    /** Every action of the catalogue, read through the manager the caller hands in. */
    async list(manager: EntityManager): Promise<Array<AuthorityActionRecord>> {
        const rows = await manager.find(AuthorityActionEntity, {
            order: { moduleKey: "ASC", sortOrder: "ASC", action: "ASC" },
            take: ACTION_LIMIT,
        })
        return rows.map((row) => ({
            action: row.action,
            module_key: row.moduleKey,
            sort_order: row.sortOrder,
            default_mode: row.defaultMode,
            default_limit_vnd: row.defaultLimitVnd === null ? null : Number(row.defaultLimitVnd),
            default_required_fields: row.defaultRequiredFields,
            amount_limit: row.amountLimit,
            max_mode: row.maxMode,
            label: row.label,
        }))
    }
}

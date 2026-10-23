import { Injectable } from "@nestjs/common"
import { DATABASE_MAX_ROWS, InjectDatabase } from "@modules/integrations/data-sources"
import type { DatabaseClient, DatabaseReader } from "@modules/integrations/data-sources"
import { isDomainError } from "@modules/platform/errors"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import type { TableMapping } from "./database-config.contracts"
import { invalid, parseConfig, parseTarget, tableKey } from "./database-config.policy"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"

const NOTE_MAX = 400

/** How one table went: the rows written and its new cursor, or the sentence that says why not. */
type TableOutcome =
    | { readonly ok: true; readonly rows: number; readonly cursor: string | null }
    | { readonly ok: false; readonly reason: string }

@Injectable()
/** Pulls the owner databases into the hub: each mapped table is read read-only, incrementally by its updated-at column. Cursors live in the connection public meta. */
export class DatabaseSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "database" as const

    constructor(
        @InjectDatabase() private readonly database: DatabaseClient,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Reads every mapped table; one table failing does not stop the others unless none succeeded. */
    sync(context: DataSyncContext): Promise<DataSyncResult> {
        const target = parseTarget(context.credential)
        const config = parseConfig(context.connection.meta.config)
        return this.database.read(target, async (reader) => {
            const meta: Record<string, string> = {}
            const problems: Array<string> = []
            let total = 0
            let done = 0
            await eachInOrder(config.tables, async (mapping) => {
                if (context.isExpired()) return
                const outcome = await this.readTable(reader, context, mapping)
                if (!outcome.ok) {
                    problems.push(`${tableKey(mapping)}: ${outcome.reason}`)
                    return
                }
                total += outcome.rows
                done += 1
                if (outcome.cursor !== null) meta[`cursor:${tableKey(mapping)}`] = outcome.cursor
            })
            const first = problems[0]
            if (done === 0 && first !== undefined) throw invalid(first)
            return {
                rows: total,
                ...(problems.length > 0 ? { note: problems.join(" | ").slice(0, NOTE_MAX) } : {}),
                ...(Object.keys(meta).length > 0 ? { meta } : {}),
            }
        })
    }

    private readTable(reader: DatabaseReader, context: DataSyncContext, mapping: TableMapping): Promise<TableOutcome> {
        return reader
            .readTable(mapping, {
                limit: DATABASE_MAX_ROWS,
                cursor: context.connection.meta[`cursor:${tableKey(mapping)}`],
            })
            .then((page) =>
                context
                    .upsert(
                        mapping.entity,
                        page.records.map((record) => ({ ...record })),
                    )
                    .then((rows): TableOutcome => ({ ok: true, rows, cursor: page.cursor })),
            )
            .then(
                (outcome) => outcome,
                (cause: unknown): Promise<TableOutcome> =>
                    isDomainError(cause)
                        ? Promise.resolve({
                              ok: false,
                              reason: this.catalog.get(`errors.${cause.code}`, cause.params, "vi"),
                          })
                        : Promise.reject(cause),
            )
    }
}

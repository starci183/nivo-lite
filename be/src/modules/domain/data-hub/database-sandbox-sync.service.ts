import { Injectable } from "@nestjs/common"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import type { DataConnector, DataSyncContext, DataSyncResult } from "./data-hub.contracts"
import {
    DATABASE_AS_OF,
    DATABASE_CASE,
    DATABASE_PULL_OPERATION,
    DATABASE_SANDBOX_PROVIDER,
    DATABASE_SANDBOX_TABLES,
    DATABASE_SANDBOX_TABLE_REFUSAL,
    databaseCursorKey,
    databasePullOf,
    databaseTableKey,
    type SandboxTable,
} from "./database-sandbox.catalogue"
import { databaseLoginRefused, databaseNoTableRead, databaseUnreachable } from "./database-sandbox.failures"

/** The most characters of the note a pull answers (the live sync's own bound). */
const NOTE_MAX = 400

/** The moment of the sandbox database a case reads (`DATABASE-1` and the failing cases read the first one). */
const asOfOf = (nextCase: string | null): number => {
    if (nextCase === DATABASE_CASE.newOrders) return DATABASE_AS_OF.newOrders
    if (nextCase === DATABASE_CASE.changedRow) return DATABASE_AS_OF.changedRow
    return DATABASE_AS_OF.first
}

/** Whether the case refuses a table. */
const refuses = (nextCase: string | null, table: SandboxTable): boolean =>
    nextCase === DATABASE_CASE.everyTableFails || (nextCase === DATABASE_CASE.oneTableFails && table.table === "orders")

@Injectable()
/**
 * The sandbox twin of the owner's database pull (`DATABASE-1` .. `7`): the normal poll of a sandbox database account hands the sandbox
 * shop's rows (customers, orders, products: a fixed history) to the SAME keep path the live pull uses (`context.upsert`, which the sync
 * service answers with the hub's rows) and never opens a database connection or reads a credential. It reads the table cursors from the
 * connection's public meta exactly as the live sync does (`cursor:<schema>.<table>`) and answers the rows changed after them as of the
 * moment the account's next case names: `DATABASE-1` (default) the first state, `-2` with two new orders, `-3` with one order changed
 * (the same row again, new status). `-4` refuses the orders table (the others are brought, the note names it), `-5` refuses every table
 * (the run fails as the live pull does when no table was read), `-6` the login, `-7` the connection. A pull is a read: no outcome is
 * unknown. One logged call per pull. UNVERIFIED against live: the words of a table's refusal (the live ones come from the message
 * catalogue of the reader's error).
 */
export class DatabaseSandboxSyncService implements DataConnector {
    /** The provider this connector serves. */
    readonly provider = "database" as const

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Reads every table of the sandbox shop that changed after its cursor; one table refused does not stop the others unless none was read. */
    sync(context: DataSyncContext): Promise<DataSyncResult> {
        const { connection } = context
        const account = {
            id: connection.id,
            workspaceId: connection.workspaceId,
            provider: DATABASE_SANDBOX_PROVIDER,
            sandbox: connection.sandbox === true,
        }
        return this.sandbox.call(account, DATABASE_PULL_OPERATION, { tables: DATABASE_SANDBOX_TABLES.map(databaseTableKey) }, {
            key: "",
            answer: async (state): Promise<DataSyncResult> => {
                if (state.nextCase === DATABASE_CASE.loginRefused) throw databaseLoginRefused()
                if (state.nextCase === DATABASE_CASE.unreachable) throw databaseUnreachable()
                const asOf = asOfOf(state.nextCase)
                const meta: Record<string, string> = {}
                const problems: Array<string> = []
                let total = 0
                let done = 0
                for (const table of DATABASE_SANDBOX_TABLES) {
                    if (context.isExpired()) break
                    const key = databaseTableKey(table)
                    if (refuses(state.nextCase, table)) {
                        problems.push(`${key}: ${DATABASE_SANDBOX_TABLE_REFUSAL} ${table.table}`)
                        continue
                    }
                    const cursor = connection.meta[databaseCursorKey(table)] ?? null
                    const pull = databasePullOf(table, asOf, cursor)
                    // One table after the other, as the live pull reads them.
                    // eslint-disable-next-line no-await-in-loop
                    total += await context.upsert(table.entity, pull.rows)
                    done += 1
                    if (pull.cursor !== null && pull.cursor !== cursor) meta[databaseCursorKey(table)] = pull.cursor
                }
                const first = problems[0]
                if (done === 0 && first !== undefined) throw databaseNoTableRead(first)
                return {
                    rows: total,
                    ...(problems.length > 0 ? { note: problems.join(" | ").slice(0, NOTE_MAX) } : {}),
                    ...(Object.keys(meta).length > 0 ? { meta } : {}),
                }
            },
        })
    }
}

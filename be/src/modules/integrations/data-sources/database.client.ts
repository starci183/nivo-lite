import { Injectable } from "@nestjs/common"
import { selectRows } from "@modules/platform/database"
import { InjectPublicHost } from "./data-sources.decorators"
import { openMssql, openMysql, openPostgres } from "./database-drivers.client"
import { toDatabaseError } from "./database-errors.policy"
import type {
    DatabasePage,
    DatabasePreview,
    DatabaseReadRun,
    DatabaseSelection,
    DatabaseSession,
    DatabaseTable,
    DatabaseTarget,
} from "./database-session.contracts"
import { buildSelect, listTables, wantedColumns } from "./database-sql.policy"
import { cursorOf, previewCells, toRecord } from "./database-values.policy"
import type { PublicHostClient } from "./public-host.client"

const PREVIEW_ROWS = 5

@Injectable()
/** The client that reads tables of the owner's database, read only. Every statement is a generated SELECT; the connection goes to the resolved public address; connect and query have time limits. */
export class DatabaseClient {
    constructor(@InjectPublicHost() private readonly publicHost: PublicHostClient) {}

    /** The tables and views the user can see, with their columns. */
    listTables(target: DatabaseTarget): Promise<ReadonlyArray<DatabaseTable>> {
        return this.within(target, (session) => listTables(session))
    }

    /** The first rows of one picked table, as text. */
    preview(target: DatabaseTarget, selection: DatabaseSelection): Promise<DatabasePreview> {
        return this.within(target, async (session) => {
            const { sql } = buildSelect(
                session.engine,
                { ...selection, updatedColumn: "" },
                { limit: PREVIEW_ROWS, ordered: false },
            )
            const rows = await selectRows(session, sql)
            const columns = wantedColumns(selection)
            return { columns, rows: previewCells(columns, rows) }
        })
    }

    /** Runs a sync callback on one read only session that is always closed afterwards. */
    read<T>(target: DatabaseTarget, run: DatabaseReadRun<T>): Promise<T> {
        return this.within(target, (session) =>
            run({
                readTable: async (selection, options): Promise<DatabasePage> => {
                    const { sql, params } = buildSelect(session.engine, selection, options)
                    const rows = await selectRows(session, sql, params)
                    const records = rows.flatMap((row) => {
                        const record = toRecord(selection, row)
                        return record === null ? [] : [record]
                    })
                    return { records, cursor: cursorOf(rows) }
                },
            }),
        )
    }

    private async within<T>(target: DatabaseTarget, run: (session: DatabaseSession) => Promise<T>): Promise<T> {
        const { address } = await this.publicHost.resolve(target.host)
        let session: DatabaseSession
        try {
            session = await this.open(target, address)
        } catch (error) {
            throw toDatabaseError(error)
        }
        let outcome: T
        try {
            outcome = await run(session)
        } catch (error) {
            await session.close()
            throw toDatabaseError(error)
        }
        await session.close()
        return outcome
    }

    private open(target: DatabaseTarget, address: string): Promise<DatabaseSession> {
        if (target.engine === "postgres") return openPostgres(target, address)
        if (target.engine === "mysql") return openMysql(target, address)
        return openMssql(target, address)
    }
}

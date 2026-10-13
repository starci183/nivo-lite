import { mock } from "@starci/jest-preset"
import type { DatabaseSelection, DatabaseSession } from "./database-session.contracts"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { DATABASE_COPY } from "./messages/database.messages"
import { buildSelect, isUsableIdentifier, listTables, quoteId, wantedColumns } from "./database-sql.policy"

const selection = (partial: Partial<DatabaseSelection> = {}): DatabaseSelection => ({
    schema: "public",
    table: "orders",
    idColumn: "id",
    titleColumn: "title",
    updatedColumn: "updated_at",
    columns: ["note", "id"],
    ...partial,
})

const LIST_POSTGRES =
    "SELECT c.table_schema AS s, c.table_name AS t, c.column_name AS c, c.data_type AS d FROM information_schema.columns c JOIN information_schema.tables x ON x.table_schema = c.table_schema AND x.table_name = c.table_name WHERE x.table_type IN ('BASE TABLE','VIEW') AND c.table_schema NOT IN ('pg_catalog','information_schema') ORDER BY c.table_schema, c.table_name, c.ordinal_position LIMIT 20000"
const LIST_MYSQL =
    "SELECT c.TABLE_SCHEMA AS s, c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS d FROM information_schema.COLUMNS c JOIN information_schema.TABLES x ON x.TABLE_SCHEMA = c.TABLE_SCHEMA AND x.TABLE_NAME = c.TABLE_NAME WHERE x.TABLE_TYPE IN ('BASE TABLE','VIEW') AND c.TABLE_SCHEMA = DATABASE() ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION LIMIT 20000"
const LIST_MSSQL =
    "SELECT TOP (20000) c.TABLE_SCHEMA AS s, c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS d FROM INFORMATION_SCHEMA.COLUMNS c JOIN INFORMATION_SCHEMA.TABLES x ON x.TABLE_SCHEMA = c.TABLE_SCHEMA AND x.TABLE_NAME = c.TABLE_NAME WHERE x.TABLE_TYPE IN ('BASE TABLE','VIEW') AND c.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA','sys') ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION"

describe("database sql", () => {
    describe("identifiers", () => {
        it("accepts a name up to 200 characters and quotes it for each engine", () => {
            const name = "a".repeat(200)

            expect(isUsableIdentifier(name)).toBe(true)
            expect(isUsableIdentifier("")).toBe(false)
            expect(isUsableIdentifier("a".repeat(201))).toBe(false)
            expect(isUsableIdentifier("a\u0000b")).toBe(false)
            expect(quoteId("mysql", "a`b")).toBe("`a``b`")
            expect(quoteId("mssql", "a]b")).toBe("[a]]b]")
            expect(quoteId("postgres", 'a"b')).toBe('"a""b"')
        })

        it("lists each mapped column once, skipping an empty title or updated column", () => {
            expect(wantedColumns(selection())).toEqual(["id", "title", "updated_at", "note"])
            expect(wantedColumns(selection({ titleColumn: "", updatedColumn: "", columns: [] }))).toEqual(["id"])
        })
    })

    describe("buildSelect", () => {
        it("rejects a schema, table or column that cannot be quoted", () => {
            const attempts = [
                selection({ schema: "bad\u0000" }),
                selection({ table: "" }),
                selection({ idColumn: "c".repeat(201) }),
            ]

            for (const picked of attempts) {
                expect(() => buildSelect("postgres", picked, { limit: 1 })).toThrow(
                    expect.objectContaining({
                        code: DataSourcesErrorCode.Rejected,
                        params: { detail: DATABASE_COPY.badName },
                    }),
                )
            }
        })

        it("selects the mapped columns, the cursor and the incremental filter for each engine", () => {
            const picked = selection()
            const options = { limit: 25.9, cursor: "2026-01-02" }

            expect(buildSelect("postgres", picked, options)).toEqual({
                sql: 'SELECT "id", "title", "updated_at", "note", ("updated_at")::text AS "__nivo_cursor" FROM "public"."orders" WHERE "updated_at" >= $1 ORDER BY "updated_at" ASC LIMIT 25',
                params: ["2026-01-02"],
            })
            expect(buildSelect("mysql", picked, options)).toEqual({
                sql: "SELECT `id`, `title`, `updated_at`, `note`, CAST(`updated_at` AS CHAR) AS `__nivo_cursor` FROM `public`.`orders` WHERE `updated_at` >= ? ORDER BY `updated_at` ASC LIMIT 25",
                params: ["2026-01-02"],
            })
            expect(buildSelect("mssql", picked, options)).toEqual({
                sql: "SELECT TOP (25) [id], [title], [updated_at], [note], CONVERT(nvarchar(40), [updated_at], 126) AS [__nivo_cursor] FROM [public].[orders] WHERE [updated_at] >= @p0 ORDER BY [updated_at] ASC",
                params: ["2026-01-02"],
            })
        })

        it("omits the filter and the order when there is no cursor or the preview asks for neither", () => {
            const picked = selection({ titleColumn: "", updatedColumn: "" })

            expect(buildSelect("postgres", picked, { limit: 0, cursor: "", ordered: false })).toEqual({
                sql: 'SELECT "id", "note" FROM "public"."orders" LIMIT 1',
                params: [],
            })
            expect(buildSelect("postgres", selection(), { limit: 5001, cursor: null }).sql).toContain("LIMIT 5000")
            expect(buildSelect("mssql", selection({ updatedColumn: "" }), { limit: -3 }).sql).toBe(
                "SELECT TOP (1) [id], [title], [note] FROM [public].[orders] ORDER BY [id] ASC",
            )
        })
    })

    describe("listTables", () => {
        const rowsOf = (count: number) =>
            Array.from({ length: count }, (_item, index) => ({
                s: "public",
                t: `t${index}`,
                c: "id",
                d: "int",
            }))

        it("groups columns under each table and stops at 500 tables and 300 columns", async () => {
            const rows = rowsOf(501)
            for (let column = 0; column < 300; column += 1)
                rows.push({ s: "public", t: "t0", c: `c${column}`, d: "text" })
            const session = mock<DatabaseSession>({ engine: "postgres" })
            session.query.mockResolvedValue(rows)

            const tables = await listTables(session)

            expect(session.query).toHaveBeenCalledWith(LIST_POSTGRES)
            expect(tables).toHaveLength(500)
            expect(tables[0]).toMatchObject({ schema: "public", name: "t0" })
            expect(tables[0]?.columns).toHaveLength(300)
            expect(tables[499]?.name).toBe("t499")
        })

        it("reads MySQL and SQL Server catalogs, including upper-case and non-text cells", async () => {
            const mysql = mock<DatabaseSession>({ engine: "mysql" })
            mysql.query.mockResolvedValue([{ S: "shop", T: "orders", C: "id", D: "int" }])
            const mssql = mock<DatabaseSession>({ engine: "mssql" })
            mssql.query.mockResolvedValue([{ s: 1, t: null, c: true, d: {} }])

            await expect(listTables(mysql)).resolves.toEqual([
                { schema: "shop", name: "orders", columns: [{ name: "id", type: "int" }] },
            ])
            await expect(listTables(mssql)).resolves.toEqual([
                { schema: "", name: "", columns: [{ name: "", type: "" }] },
            ])
            expect(mysql.query).toHaveBeenCalledWith(LIST_MYSQL)
            expect(mssql.query).toHaveBeenCalledWith(LIST_MSSQL)
        })
    })
})

import type { DbEngine } from "@/modules/types"

/** The engines, in the order the select shows them. */
export const DB_ENGINES: ReadonlyArray<DbEngine> = ["postgres", "mysql", "mssql"]

/** The default port of each engine. */
export const DB_DEFAULT_PORT: Readonly<Record<DbEngine, number>> = { postgres: 5432, mysql: 3306, mssql: 1433 }

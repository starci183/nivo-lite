import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DatabaseClient } from "./database.client"
import type { DataSourcesOptions } from "./data-sources.options"
import type { ImapClient } from "./imap.client"
import type { OpenApiClient } from "./openapi.client"
import type { PublicHostClient } from "./public-host.client"
import type { TableClient } from "./table.client"

/** Token of the options of the data-sources integration, exported so a spec can provide it. */
export const DATA_SOURCES_OPTIONS: unique symbol = Symbol("integrations.data-sources.options")

/** Token of the public-host guard. */
export const PUBLIC_HOST: unique symbol = Symbol("integrations.data-sources.public-host")

/** Token of the IMAP client. */
export const IMAP: unique symbol = Symbol("integrations.data-sources.imap")

/** Token of the database client. */
export const DATABASE: unique symbol = Symbol("integrations.data-sources.database")

/** Token of the OpenAPI client. */
export const OPENAPI: unique symbol = Symbol("integrations.data-sources.openapi")

/** Token of the table and document reader. */
export const TABLE: unique symbol = Symbol("integrations.data-sources.table")

/** Injects the options of the data-sources integration. Parameter type: DataSourcesOptions. */
export const InjectDataSourcesOptions = (): TypedParameterDecorator<DataSourcesOptions> =>
    injector<DataSourcesOptions>(DATA_SOURCES_OPTIONS)

/** Injects the public-host guard. Parameter type: PublicHostClient. */
export const InjectPublicHost = (): TypedParameterDecorator<PublicHostClient> => injector<PublicHostClient>(PUBLIC_HOST)

/** Injects the IMAP client. Parameter type: ImapClient. */
export const InjectImap = (): TypedParameterDecorator<ImapClient> => injector<ImapClient>(IMAP)

/** Injects the database client. Parameter type: DatabaseClient. */
export const InjectDatabase = (): TypedParameterDecorator<DatabaseClient> => injector<DatabaseClient>(DATABASE)

/** Injects the OpenAPI client. Parameter type: OpenApiClient. */
export const InjectOpenApi = (): TypedParameterDecorator<OpenApiClient> => injector<OpenApiClient>(OPENAPI)

/** Injects the table and document reader. Parameter type: TableClient. */
export const InjectTable = (): TypedParameterDecorator<TableClient> => injector<TableClient>(TABLE)

import type { InjectionToken } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"
import type { PostgresRealtimeOptions, RealtimeConfig, RealtimeOptions } from "./realtime.options"

/** Binds the parsed hub to the connection the app composes: only the Postgres hub has one; it carries the dedicated LISTEN URL when one is declared. */
export const withConnection = (config: RealtimeConfig, connection: InjectionToken, url: Secret): RealtimeOptions =>
    config.hub === "postgres" ? { hub: "postgres", connection, url, listenUrl: config.listenUrl } : config

/** The URL the Postgres hub LISTENs on: the dedicated one when declared, else the primary URL. */
export const listenUrlOf = (options: PostgresRealtimeOptions): Secret =>
    options.listenUrl === undefined ? options.url : options.listenUrl

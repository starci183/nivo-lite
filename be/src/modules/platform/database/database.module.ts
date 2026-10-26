import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TypeOrmModule, getDataSourceToken } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { DATABASE_OPTIONS } from "./database.port"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./database.module-definition"
import { AfterCommitClient } from "./after-commit.client"
import { MigrationRunnerService } from "./migration-runner.service"
import { PRIMARY_CONNECTION } from "./primary.connection"
import { AFTER_COMMIT, PRIMARY_ENTITY_MANAGER, RATE_LIMIT_STORE } from "./primary.decorators"
import { PostgresRateLimitStoreClient } from "./postgres-rate-limit-store.client"
import { SeedRunnerService } from "./seed-runner.service"

/** The token each declared connection provides its shared EntityManager under. */
type EntityManagerToken = typeof PRIMARY_ENTITY_MANAGER

/** Token of the provider that subscribes the after-commit capability to the primary connection. */
const AFTER_COMMIT_SUBSCRIPTION: unique symbol = Symbol("platform.database.after-commit-subscription")

const ENTITY_MANAGER_TOKENS: ReadonlyMap<string, EntityManagerToken> = new Map<string, EntityManagerToken>([
    [PRIMARY_CONNECTION, PRIMARY_ENTITY_MANAGER],
])

@Module({})
/**
 * Opens each named Supabase PostgreSQL connection and exposes its shared EntityManager without entities or migrations.
 */
export class DatabaseModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the connections it opens. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const managers = options.connections.flatMap((connection) => {
            const token = ENTITY_MANAGER_TOKENS.get(connection.name)
            return token === undefined
                ? []
                : [
                      {
                          provide: token,
                          inject: [getDataSourceToken(connection.name)],
                          useFactory: (source: DataSource) => source.manager,
                      },
                  ]
        })
        const afterCommit = [
            { provide: AFTER_COMMIT, useExisting: AfterCommitClient },
            AfterCommitClient,
            {
                provide: AFTER_COMMIT_SUBSCRIPTION,
                inject: [getDataSourceToken(PRIMARY_CONNECTION), AfterCommitClient],
                useFactory: (source: DataSource, client: AfterCommitClient) =>
                    source.subscribers.push({
                        afterTransactionCommit: (event) => client.commit(event.manager),
                        afterTransactionRollback: (event) => client.rollback(event.manager),
                    }),
            },
        ]
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                ...options.connections.map((connection) => {
                    const schema: Partial<Record<"schema", string>> =
                        connection.schema === undefined ? {} : { schema: connection.schema }
                    return TypeOrmModule.forRoot({
                        name: connection.name,
                        type: "postgres",
                        url: connection.url.reveal(),
                        ...schema,
                        synchronize: false,
                        retryAttempts: 2,
                        extra: { types: options.typeParsers() },
                    })
                }),
            ],
            providers: [
                ...(base.providers ?? []),
                ...managers,
                { provide: RATE_LIMIT_STORE, useClass: PostgresRateLimitStoreClient },
                ...afterCommit,
                MigrationRunnerService,
                SeedRunnerService,
            ],
            exports: [
                DATABASE_OPTIONS,
                RATE_LIMIT_STORE,
                AFTER_COMMIT,
                ...managers.map((manager) => manager.provide),
                MigrationRunnerService,
                SeedRunnerService,
            ],
        }
    }
}

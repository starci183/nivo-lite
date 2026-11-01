import assert from "node:assert/strict"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { fakeIds } from "@starci/jest-preset"
import type { TestingModule } from "@nestjs/testing"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { ClockModule } from "@modules/platform/clock"
import { EventBusModule } from "@modules/platform/event-bus"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { HttpModule } from "@modules/platform/http"
import { LoggingModule } from "@modules/platform/logging"
import { RealtimeModule } from "@modules/platform/realtime"
import { RetryModule } from "@modules/platform/retry"
import { eachInOrder } from "@modules/platform/primitives"
import { CHAT_ACTIVITY_PROOF_MODULES } from "./chat-activity-proof.module"
import type { WorldDatabase, WorldSandbox } from "./test-world.contracts"

/** One hex group per run (process and monotonic clock), so the ids of two runs never meet in the database a proof writes to. */
const RUN_GROUP = ((process.pid % 0x10000) * 0x10000 + Number(process.hrtime.bigint() % 0x10000n)).toString(16)

/** The ids of a proof: the `Ids` port as the specs use it, counting from a prefix that is new in every run. */
export const worldIds = fakeIds(RUN_GROUP)

@Module({})
class LocalDatabaseModule {
    static register(manager: EntityManager): DynamicModule {
        return {
            module: LocalDatabaseModule,
            global: true,
            providers: [
                { provide: PRIMARY_ENTITY_MANAGER, useFactory: () => manager },
                { provide: INBOX, useFactory: () => new InboxService() },
            ],
            exports: [PRIMARY_ENTITY_MANAGER, INBOX],
        }
    }
}

/** The creation and update instants the entities leave to the database: a proof must be able to write them to set the scene of an earlier day. */
const STAMP_PROPERTIES: ReadonlySet<string> = new Set(["createdAt", "updatedAt"])

/**
 * Production never writes the stamps of a row (the entity base marks them `insert: false, update: false` and the database sets
 * them), so a persisting builder that names a past instant would be ignored. In the world only, the stamps are writable; a row whose
 * builder names none still gets the database default, and the update trigger still moves `updated_at` on a change.
 */
const letProofsStampRows = (source: DataSource): void => {
    source.entityMetadatas
        .flatMap((metadata) => metadata.columns)
        .filter((column) => STAMP_PROPERTIES.has(column.propertyName))
        .forEach((column) => {
            column.isInsert = true
            column.isUpdate = true
        })
}

/** Attaches only to migrated local PostgreSQL; the closure owns resources rather than injecting a DataSource into services. */
export const createLiteWorld = (modules: ReadonlyArray<DynamicModule>, sandbox?: WorldSandbox) => {
    let source: DataSource | undefined
    let container: TestingModule | undefined
    const cleanups: Array<() => Promise<void>> = []
    const prefix = `lite-proof-${worldIds.next()}`
    const database = (): WorldDatabase => {
        assert(source?.isInitialized, "Local PostgreSQL world must be open")
        return { primary: source.manager }
    }
    return {
        prefix,
        get db(): WorldDatabase {
            return database()
        },
        async open(): Promise<void> {
            const config = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
            const url = sandbox === undefined ? config.url.reveal() : await sandbox.create()
            assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Proofs need local PostgreSQL")
            const schema: Partial<Record<"schema", string>> =
                config.schema === undefined ? {} : { schema: config.schema }
            source = new DataSource({
                type: "postgres",
                name: config.name,
                url,
                ...schema,
                entities: [...PRIMARY_ENTITIES],
                uuidExtension: "pgcrypto",
                synchronize: false,
                connectTimeoutMS: 5000,
            })
            await source.initialize()
            letProofsStampRows(source)
            container = await Test.createTestingModule({
                imports: [
                    LocalDatabaseModule.register(database().primary),
                    ClockModule.register({ isGlobal: true }),
                    EventBusModule.register({ isGlobal: true }),
                    HttpModule.register({ isGlobal: true }),
                    LoggingModule.register({ isGlobal: true }),
                    RetryModule.register({ isGlobal: true }),
                    RealtimeModule.register({ hub: "memory", isGlobal: true }),
                    ...CHAT_ACTIVITY_PROOF_MODULES,
                    ...modules,
                ],
            }).compile()
        },
        resolve<T>(token: string | symbol | (new (...args: Array<never>) => T)): T {
            assert(container, "World modules must be open")
            return container.get<T>(token)
        },
        id(): string {
            return worldIds.next()
        },
        key(scenario: string): string {
            return `${prefix}-${scenario}`
        },
        cleanup(work: () => Promise<void>): void {
            cleanups.push(work)
        },
        async close(): Promise<void> {
            try {
                if (source?.isInitialized) {
                    cleanups.reverse()
                    await eachInOrder(cleanups, (cleanup) => cleanup())
                }
            } finally {
                try {
                    await container?.close()
                } finally {
                    try {
                        if (source?.isInitialized) await source.destroy()
                    } finally {
                        await sandbox?.drop()
                    }
                }
            }
        },
    }
}
/** The live resource accessors returned to each suite. */
export type LiteWorld = ReturnType<typeof createLiteWorld>

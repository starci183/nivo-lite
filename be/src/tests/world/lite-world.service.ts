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
import { ClockModule } from "@modules/platform/clock"
import { HttpModule } from "@modules/platform/http"
import { LoggingModule } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { WorldDatabase } from "./test-world.contracts"

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
            providers: [{ provide: PRIMARY_ENTITY_MANAGER, useFactory: () => manager }],
            exports: [PRIMARY_ENTITY_MANAGER],
        }
    }
}

/** Attaches only to migrated local Supabase; the closure owns resources rather than injecting a DataSource into services. */
export const createLiteWorld = (modules: ReadonlyArray<DynamicModule>) => {
    let source: DataSource | undefined
    let container: TestingModule | undefined
    const cleanups: Array<() => Promise<void>> = []
    const prefix = `lite-proof-${worldIds.next()}`
    const database = (): WorldDatabase => {
        assert(source?.isInitialized, "Local Supabase world must be open")
        return { primary: source.manager }
    }
    return {
        prefix,
        get db(): WorldDatabase {
            return database()
        },
        async open(): Promise<void> {
            const config = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
            const url = config.url.reveal()
            assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Proofs require local Supabase")
            const schema: Partial<Record<"schema", string>> =
                config.schema === undefined ? {} : { schema: config.schema }
            source = new DataSource({
                type: "postgres",
                name: config.name,
                url,
                ...schema,
                synchronize: false,
                connectTimeoutMS: 5000,
            })
            await source.initialize()
            container = await Test.createTestingModule({
                imports: [
                    LocalDatabaseModule.register(database().primary),
                    ClockModule.register({ isGlobal: true }),
                    HttpModule.register({ isGlobal: true }),
                    LoggingModule.register({ isGlobal: true }),
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
                    if (source?.isInitialized) await source.destroy()
                }
            }
        },
    }
}
/** The live resource accessors returned to each suite. */
export type LiteWorld = ReturnType<typeof createLiteWorld>

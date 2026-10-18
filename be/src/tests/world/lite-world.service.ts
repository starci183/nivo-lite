import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Test } from "@nestjs/testing"
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
    const prefix = `lite-proof-${randomUUID()}`
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
            source = new DataSource({
                type: "postgres",
                name: config.name,
                url,
                schema: config.schema,
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
            return randomUUID()
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

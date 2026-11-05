import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { RedisClient } from "./redis.client"
import { REDIS_CLIENT, REDIS_OPTIONS } from "./redis.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./redis.module-definition"

@Module({})
/** The Redis integration: the client that opens connections for the capabilities that keep state in Redis. */
export class RedisModule extends ConfigurableModuleClass {
    /** Registers the integration once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: REDIS_OPTIONS, useValue: options },
                RedisClient,
                { provide: REDIS_CLIENT, useExisting: RedisClient },
            ],
            exports: [REDIS_CLIENT],
        }
    }
}

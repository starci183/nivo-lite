import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AiRouterModule, AiRouterService } from "@starci/ai-router"
import { AiPoolClient } from "./ai-pool.client"
import { AI_POOL, AI_POOL_ROUTER } from "./ai-pool.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai-pool.module-definition"
import { routerOptionsOf } from "./ai-pool-router.mapper"

@Module({})
/**
 * Provides the AI pool client and its injection token (`AI_POOL`). With at least one key it registers the router once,
 * privately, over the parsed pool; with none it registers no router (the router refuses an empty pool) and the client answers
 * nothing, so the app boots without AI keys.
 */
export class AiPoolModule extends ConfigurableModuleClass {
    /** Registers the pool once per app that calls a model. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, ...pool } = options
        const router = routerOptionsOf(pool)
        const imports: Array<DynamicModule> = router === null ? [] : [AiRouterModule.register(router)]
        return {
            ...base,
            imports: [...(base.imports ?? []), ...imports],
            providers: [
                ...(base.providers ?? []),
                router === null
                    ? { provide: AI_POOL_ROUTER, useValue: null }
                    : { provide: AI_POOL_ROUTER, useExisting: AiRouterService },
                AiPoolClient,
                { provide: AI_POOL, useExisting: AiPoolClient },
            ],
            exports: [AiPoolClient, AI_POOL],
        }
    }
}

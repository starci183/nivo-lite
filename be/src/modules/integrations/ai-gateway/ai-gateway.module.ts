import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AiRouterGatewayModule, AiRouterModule, AiRouterService } from "@starci/ai-router"
import { openSqliteKeyStore } from "@starci/ai-router/gateway"
import { AI_GATEWAY_ROUTER } from "./ai-gateway.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai-gateway.module-definition"
import type { AiGatewayHost } from "./ai-gateway.options"
import { AiGatewaySubscription } from "./ai-gateway.subscription"
import { routerOptionsOf } from "./ai-gateway-router.mapper"

/** Every interface: the agent runtime reaches the gateway from its own container, not only from loopback (BE-AI-6). */
const GATEWAY_HOST = "0.0.0.0"

/** The gateway over the registered router: virtual keys in a SQLite file, the admin token read at each admin request, its own port (the app port plus one). */
const gatewayOf = (gateway: AiGatewayHost): DynamicModule =>
    AiRouterGatewayModule.registerAsync({
        useFactory: async () => ({
            keys: await openSqliteKeyStore(gateway.keysPath),
            adminToken: () => gateway.adminToken?.reveal(),
            listen: { offset: 1, host: GATEWAY_HOST },
        }),
    })

@Module({})
/**
 * Registers the two package modules over the parsed pool: the router (profiles `work` and `embed` over the upstream providers) and,
 * in the process that hosts it, the OpenAI-compatible gateway that issues virtual keys. With no upstream key it registers neither
 * (the router refuses an empty pool) and the app boots with AI unavailable.
 */
export class AiGatewayModule extends ConfigurableModuleClass {
    /** Registers the pool once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, ...pool } = options
        const router = routerOptionsOf(pool)
        const imports: Array<DynamicModule> =
            router === null
                ? []
                : [AiRouterModule.register(router), ...(pool.gateway === null ? [] : [gatewayOf(pool.gateway)])]
        return {
            ...base,
            imports: [...(base.imports ?? []), ...imports],
            providers: [
                ...(base.providers ?? []),
                router === null
                    ? { provide: AI_GATEWAY_ROUTER, useValue: null }
                    : { provide: AI_GATEWAY_ROUTER, useExisting: AiRouterService },
                AiGatewaySubscription,
            ],
        }
    }
}

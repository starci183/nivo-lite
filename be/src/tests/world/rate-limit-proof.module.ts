import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { appPgTypes } from "@modules/integrations/data-sources"
import { DatabaseModule, RATE_LIMIT_STORE } from "@modules/platform/database"
import type { RateLimitStore } from "@modules/platform/database"
import { HttpSecurityModule, RateLimitGuard } from "@modules/platform/http-security"
import type { LiteWorld } from "./lite-world.service"

@Module({ providers: [Reflector, RateLimitGuard], exports: [RateLimitGuard] })
/** Registers the same guard each API app places before its identity guards. */
export class RateLimitProofModule {
    /** Exposes the guard to the independently composed replica world. */
    static register(): DynamicModule {
        return { module: RateLimitProofModule }
    }
}

/** Each world opens its own primary connection and registers the real shared rate-limit store. */
export const RATE_LIMIT_PROOF_MODULES: ReadonlyArray<DynamicModule> = [
    DatabaseModule.register({ isGlobal: true, connections: [], typeParsers: appPgTypes }),
    HttpSecurityModule.register({
        isGlobal: true,
        trustedProxyHops: 1,
        allowedOrigins: [],
        rateLimit: { windowMs: 60_000, defaultLimit: 3, strictLimit: 1 },
        webhooks: {},
    }),
    RateLimitProofModule.register(),
]

/** Resolves the real database-owned store from one independently composed replica world. */
export const sharedRateLimitStore = (world: LiteWorld): RateLimitStore =>
    world.resolve<RateLimitStore>(RATE_LIMIT_STORE)

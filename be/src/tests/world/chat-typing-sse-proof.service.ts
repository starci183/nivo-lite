import assert from "node:assert/strict"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import type { EntityManager } from "typeorm"
import * as typingContract from "@modules/domain/chat-typing"
import { ChatTypingModule, ChatTypingService } from "@modules/domain/chat-typing"
import { CHAT_MARKERS_ERROR_KINDS, CHAT_MARKERS_MESSAGES } from "@modules/domain/chat-markers"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { AuthGuard, IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule } from "@modules/domain/identity"
import { WORKSPACE_MEMBERS_ERROR_KINDS, WORKSPACE_MEMBERS_MESSAGES } from "@modules/domain/workspace-members"
import { refuseSupabaseSessions } from "@modules/integrations/supabase"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { ClockModule } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import { I18nModule } from "@modules/platform/i18n"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { LoggingModule } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import * as realtimeContract from "@modules/platform/realtime"
import { RealtimeModule } from "@modules/platform/realtime"
import type { ChatMarkersIdentity } from "../fixtures/builders/chat-markers.builder"
import { ChatMarkersProofModule } from "./chat-markers-proof.module"
import type { LiteWorld } from "./lite-world.service"
import { redisProofOptions } from "./redis-capabilities.options"
import { openTypingStream } from "./realtime-stream-proof.service"
import type { TypingStreamClient, TypingStreamOptions } from "./realtime-stream-proof.service"

/** Minimal contract shapes keep this TDD proof compilable before the hub and door lanes merge. No runtime double is supplied. */
interface ProofTopic {
    readonly name: string
    accepts(frame: unknown): frame is object
}

interface ProofHub {
    subscriberCount(topic: ProofTopic): number
}

interface TypingTopicContract {
    chatTypingTopic(recipientId: string, workspaceId: string, target: ChatTarget): ProofTopic
}

interface DoorRegistrar {
    register(options: Record<never, never>): DynamicModule
}

interface RetryRegistration {
    readonly isGlobal: boolean
}

interface RetryRegistrar {
    register(options: RetryRegistration): DynamicModule
}

interface TypingDoorContract {
    readonly ChatTypingSseModule: DoorRegistrar
}

interface RetryContract {
    readonly RetryModule: RetryRegistrar
}

interface RedisHubOptions {
    readonly hub: "redis"
    readonly url: Secret
    readonly db: number
    readonly prefix: string
    readonly isGlobal: boolean
}

const isTopicContract = (value: unknown): value is TypingTopicContract =>
    typeof value === "object" &&
    value !== null &&
    "chatTypingTopic" in value &&
    typeof value.chatTypingTopic === "function"

const isDoorContract = (value: unknown): value is TypingDoorContract => {
    if (typeof value !== "object" || value === null || !("ChatTypingSseModule" in value)) return false
    const door = value.ChatTypingSseModule
    return typeof door === "function" && "register" in door && typeof door.register === "function"
}

const isRetryContract = (value: unknown): value is RetryContract => {
    if (typeof value !== "object" || value === null || !("RetryModule" in value)) return false
    const retry = value.RetryModule
    return typeof retry === "function" && "register" in retry && typeof retry.register === "function"
}

const isHub = (value: unknown): value is ProofHub =>
    typeof value === "object" &&
    value !== null &&
    "subscriberCount" in value &&
    typeof value.subscriberCount === "function"

/** Real membership and target services share the same disposable database as the persisted fixtures. */
@Module({})
class TypingProofDatabaseModule {
    static register(manager: EntityManager): DynamicModule {
        return {
            module: TypingProofDatabaseModule,
            global: true,
            imports: [ChatMarkersProofModule.register()],
            providers: [{ provide: PRIMARY_ENTITY_MANAGER, useFactory: () => manager }],
            exports: [PRIMARY_ENTITY_MANAGER, ChatMarkersProofModule],
        }
    }
}

/** Only the verifier boundary is deterministic; the actual default-deny and production membership guards run. */
const verifierFor = (identity: ChatMarkersIdentity): VerifySupabaseAccessToken => {
    const ids = [identity.ownerId, ...identity.readerIds, identity.outsiderId, identity.foreignOwnerId]
    const principals = new Map(ids.map((id) => [`proof-${id}`, id]))
    return (token) => {
        const id = principals.get(token)
        return id === undefined
            ? refuseSupabaseSessions(token)
            : Promise.resolve(ok({ id, role: "authenticated" as const }))
    }
}

/** The hub, topic, door and retry contracts, each asserted present so an absent lane fails by name. */
const loadContracts = async () => {
    assert(
        "REALTIME_HUB" in realtimeContract && typeof realtimeContract.REALTIME_HUB === "symbol",
        "SSE contract implementation absent: @modules/platform/realtime must export REALTIME_HUB (hub lane)",
    )
    assert(isTopicContract(typingContract), "SSE contract implementation absent: chatTypingTopic (transport lane)")
    // A variable contract path postpones resolution until runtime, without manufacturing a production module or loosening tsc.
    const doorPath = "@features/realtime/chat-typing"
    const door: unknown = await import(doorPath)
    assert(isDoorContract(door), "SSE contract implementation absent: ChatTypingSseModule.register (transport lane)")
    const retryPath = "@modules/platform/retry"
    const retry: unknown = await import(retryPath)
    assert(isRetryContract(retry), "SSE contract implementation absent: RetryModule.register (hub lane)")
    return { hubToken: realtimeContract.REALTIME_HUB, topicOf: typingContract.chatTypingTopic, door, retry }
}

/** The platform capabilities every replica registers, with the production i18n and error mapping. */
const platformModules = (retry: RetryContract): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    retry.RetryModule.register({ isGlobal: true }),
    HttpSecurityModule.register({
        isGlobal: true,
        trustedProxyHops: 0,
        allowedOrigins: [],
        rateLimit: { windowMs: 1000, defaultLimit: 100, strictLimit: 100 },
        webhooks: {},
    }),
    I18nModule.register({
        isGlobal: true,
        bundles: [
            ERRORS_MESSAGES,
            IDENTITY_MESSAGES,
            WORKSPACE_MEMBERS_MESSAGES,
            CHAT_MARKERS_MESSAGES,
            HTTP_SECURITY_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            IDENTITY_ERROR_KINDS,
            WORKSPACE_MEMBERS_ERROR_KINDS,
            CHAT_MARKERS_ERROR_KINDS,
            HTTP_SECURITY_ERROR_KINDS,
        ],
    }),
]

/** An independently composed API replica with the actual Redis hub, typing publisher and SSE door. */
export const startTypingReplica = async (world: LiteWorld, identity: ChatMarkersIdentity, prefix: string) => {
    const contracts = await loadContracts()
    const redis = redisProofOptions(prefix)
    const options: RedisHubOptions = {
        hub: "redis",
        url: new Secret(`redis://127.0.0.1:${redis.redisPort}`),
        db: 0,
        prefix,
        isGlobal: true,
    }
    const moduleRef = await Test.createTestingModule({
        imports: [
            TypingProofDatabaseModule.register(world.db.primary),
            ...platformModules(contracts.retry),
            IdentityModule.register({ isGlobal: true, verifyAccessToken: verifierFor(identity) }),
            RealtimeModule.register(options),
            ChatTypingModule.register({ isGlobal: true }),
            contracts.door.ChatTypingSseModule.register({}),
        ],
        providers: [
            { provide: APP_GUARD, useClass: AuthGuard },
            { provide: APP_FILTER, useClass: ErrorsFilter },
        ],
    }).compile()
    const app = moduleRef.createNestApplication({ logger: false })
    const streams = new Set<TypingStreamClient>()
    try {
        await app.listen(0, "127.0.0.1")
        const hub: unknown = app.get(contracts.hubToken)
        assert(isHub(hub), "The selected production hub must expose subscriberCount")
        const origin = await app.getUrl()
        return {
            hub,
            origin,
            typing: app.get(ChatTypingService),
            topic: (recipientId: string, target: ChatTarget) =>
                contracts.topicOf(recipientId, identity.workspaceId, target),
            open: async (streamOptions: TypingStreamOptions): Promise<TypingStreamClient> => {
                const stream = await openTypingStream(origin, streamOptions)
                streams.add(stream)
                return stream
            },
            close: async (): Promise<void> => {
                try {
                    await Promise.all(Array.from(streams, (stream) => stream.disconnect()))
                } finally {
                    await app.close()
                }
            },
        }
    } catch (cause: unknown) {
        await app.close()
        throw cause
    }
}

/** Two real application lifecycles, independent hubs and one private Redis namespace; always close clients before apps. */
export const withTypingReplicas = async (
    world: LiteWorld,
    identity: ChatMarkersIdentity,
    prove: (
        a: Awaited<ReturnType<typeof startTypingReplica>>,
        b: Awaited<ReturnType<typeof startTypingReplica>>,
    ) => Promise<void>,
): Promise<void> => {
    const prefix = world.key(`realtime-${world.id()}`)
    const a = await startTypingReplica(world, identity, prefix)
    try {
        const b = await startTypingReplica(world, identity, prefix)
        try {
            assert(
                a.origin !== b.origin && a.hub !== b.hub,
                "Replica proof requires two apps and independent hub instances",
            )
            await prove(a, b)
        } finally {
            await b.close()
        }
    } finally {
        await a.close()
    }
}

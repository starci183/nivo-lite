import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionApiTokenService, randomSecret, safeEqual } from "@modules/domain/connection-secrets"
import { ConnectionsService, sha256, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { ConnectionReadyEvent } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectEventBus, type EventBus } from "@modules/platform/event-bus"
import type {
    ChannelSeed,
    SeedGoogle,
    SeedPayos,
    SeededConnection,
    SeedSepay,
    SeedTelegram,
    SeedZaloOa,
} from "./channel-seed.contracts"
import {
    bankFactsOf,
    filled,
    googleClientOf,
    invalidSeed,
    issuedOf,
    payosKeysOf,
    sepayKeyOf,
} from "./channel-seed.policy"
import { isTelegramToken, isZaloAppId, sepayFeedSecret } from "./money-provider.policy"
import { parseZaloSecret } from "./zalo-secret.policy"

/** What a connection holds before its credentials are given. */
const EMPTY_CREDENTIAL = "{}"

/** What a new seeded connection starts with. */
interface Newcomer {
    readonly id: string
    readonly provider: SeededConnection["provider"]
    readonly name: string
    readonly meta: Readonly<Record<string, string>>
    readonly plain: string
    readonly webhookSecret: string
}

/** The Zalo values a seed gave; an absent one is left as the row has it. */
interface ZaloGiven {
    readonly appId: string | undefined
    readonly appSecret: string | undefined
    readonly oaSecret: string | undefined
}

/** The public facts a Zalo connection keeps: its app id and whether the OA secret key is saved. */
const zaloMeta = (appId: string | undefined, oaSecret: string | undefined): Readonly<Record<string, string>> => ({
    ...(appId === undefined ? {} : { app_id: appId }),
    oa_secret_saved: String(oaSecret !== undefined),
})

/** What one connection ended as. */
const outcomeOf = (
    provider: SeededConnection["provider"],
    id: string,
    found: ConnectionRecord | null,
    saved: boolean,
): SeededConnection => ({
    provider,
    id,
    action: found === null ? "created" : "kept",
    credentials: saved ? "saved" : "missing",
})

@Injectable()
/**
 * Ensures the connections of a seeded workspace under ids that never change. A missing row is created pending, with the credentials
 * given or without them; an existing row keeps its id, its status and the tokens a provider issued, and takes only the credentials
 * given. Nothing here reaches a provider: the owner checks each connection in the console.
 */
export class ChannelSeedService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly apiTokens: ConnectionApiTokenService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly bus: EventBus,
    ) {}

    /** Ensures the connections of the workspace of `actor`; answers what each ended as, never a value. */
    async ensure(actor: ConnectionActor, seed: ChannelSeed): Promise<ReadonlyArray<SeededConnection>> {
        const seeded = [
            await this.telegram(actor, seed.telegram),
            await this.zaloOa(actor, seed.zaloOa),
            await this.sepay(actor, seed.sepay),
            await this.payos(actor, seed.payos),
        ]
        const google = await this.google(actor, seed.google)
        return google === undefined ? seeded : [...seeded, google]
    }

    /**
     * The Google connection, only when the OAuth client is given. It is made pending with `consent: needed` in its public facts and
     * no token: Google issues the tokens to the owner's consent alone. A connection that already consented keeps its tokens.
     */
    private async google(actor: ConnectionActor, seed: SeedGoogle | undefined): Promise<SeededConnection | undefined> {
        const client = googleClientOf(seed)
        if (seed === undefined || client === undefined) return undefined
        const plain = JSON.stringify({ oauth_client_id: client.clientId, oauth_client_secret: client.clientSecret })
        const found = await this.connections.find(actor.workspaceId, seed.id)
        if (found === null) {
            await this.create(actor, {
                id: seed.id,
                provider: "google",
                name: "Google",
                meta: { oauth_client_id: client.clientId, consent: "needed" },
                plain,
                webhookSecret: randomSecret(),
            })
        } else if (found.status === "pending") {
            if ((await this.storedOf(seed.id)) !== plain) await this.connections.writeSecret(seed.id, plain)
            if (found.meta.oauth_client_id !== client.clientId) {
                await this.connections.patch(actor.workspaceId, seed.id, {
                    meta: { ...found.meta, oauth_client_id: client.clientId, consent: "needed" },
                })
            }
        }
        const consent = found?.status === "connected" ? "given" : "needed"
        return { ...outcomeOf("google", seed.id, found, true), consent }
    }

    private async telegram(actor: ConnectionActor, seed: SeedTelegram): Promise<SeededConnection> {
        const token = filled(seed.token)
        if (token !== undefined && !isTelegramToken(token)) invalidSeed("telegram.token")
        const found = await this.connections.find(actor.workspaceId, seed.id)
        if (found === null) {
            await this.create(actor, {
                id: seed.id,
                provider: "telegram",
                name: "Telegram",
                meta: {},
                plain: token ?? EMPTY_CREDENTIAL,
                webhookSecret: randomSecret(),
            })
        } else if (token !== undefined && !safeEqual(token, (await this.storedOf(seed.id)) ?? "")) {
            await this.connections.writeSecret(seed.id, token)
        }
        return outcomeOf("telegram", seed.id, found, token !== undefined)
    }

    private async zaloOa(actor: ConnectionActor, seed: SeedZaloOa): Promise<SeededConnection> {
        const appId = issuedOf(seed.appId)
        if (appId !== undefined && !isZaloAppId(appId)) invalidSeed("zalo.appId")
        const given: ZaloGiven = { appId, appSecret: issuedOf(seed.appSecret), oaSecret: issuedOf(seed.oaSecret) }
        const found = await this.connections.find(actor.workspaceId, seed.id)
        if (found === null) {
            await this.create(actor, {
                id: seed.id,
                provider: "zalo_oa",
                name: "Zalo OA",
                meta: zaloMeta(given.appId, given.oaSecret),
                plain: JSON.stringify({
                    appId: given.appId ?? "",
                    appSecret: given.appSecret ?? "",
                    oaSecret: given.oaSecret ?? "",
                }),
                webhookSecret: randomSecret(),
            })
        } else {
            await this.mergeZalo(actor, found, given)
        }
        const saved = given.appId !== undefined && given.appSecret !== undefined && given.oaSecret !== undefined
        return outcomeOf("zalo_oa", seed.id, found, saved)
    }

    /** Writes the Zalo values given into the credential the row holds, so the tokens Zalo issued stay. */
    private async mergeZalo(actor: ConnectionActor, found: ConnectionRecord, given: ZaloGiven): Promise<void> {
        const current = parseZaloSecret((await this.connections.readSecret(found.id))?.plain ?? "")
        const next = {
            ...current,
            appId: given.appId ?? current?.appId ?? "",
            appSecret: given.appSecret ?? current?.appSecret ?? "",
            oaSecret: given.oaSecret ?? current?.oaSecret ?? "",
        }
        if (JSON.stringify(next) === JSON.stringify(current)) return
        await this.connections.writeSecret(found.id, JSON.stringify(next))
        await this.connections.patch(actor.workspaceId, found.id, {
            meta: zaloMeta(filled(next.appId), filled(next.oaSecret)),
        })
    }

    private async sepay(actor: ConnectionActor, seed: SeedSepay): Promise<SeededConnection> {
        const key = sepayKeyOf(seed)
        const facts = bankFactsOf(seed)
        const found = await this.connections.find(actor.workspaceId, seed.id)
        if (found === null) {
            const secret = sepayFeedSecret(key ?? `nivo_${randomSecret()}`)
            await this.create(actor, { id: seed.id, provider: "sepay", name: "SePay", meta: facts, ...secret })
        } else {
            await this.keepSepay(actor, found, key, facts)
        }
        const apiToken = filled(seed.apiToken)
        if (apiToken !== undefined && (await this.apiTokens.write(seed.id, apiToken))) {
            await this.announceReady(actor, seed.id, apiToken)
        }
        return outcomeOf("sepay", seed.id, found, key !== undefined)
    }

    /**
     * Tells the app the feed can be read back from SePay now that its API token is stored, so the first poll runs at once and recovers the
     * transactions SePay held before the webhook existed. The same token stored again is the same fact.
     */
    private announceReady(actor: ConnectionActor, connectionId: string, apiToken: string): Promise<void> {
        const dedupeKey = `${connectionId}:api_token:${sha256(apiToken).slice(0, 16)}`
        const event = ConnectionReadyEvent.create({
            workspaceId: actor.workspaceId,
            connectionId,
            provider: "sepay",
            dedupeKey,
        })
        return this.entityManager.transaction((tx) => this.bus.publish(event, tx, dedupeKey))
    }

    /** Takes the key and the bank facts given into an existing feed; a key the row already holds is not written again. */
    private async keepSepay(
        actor: ConnectionActor,
        found: ConnectionRecord,
        key: string | undefined,
        facts: Readonly<Record<string, string>>,
    ): Promise<void> {
        if (key !== undefined && !safeEqual(key, (await this.storedOf(found.id)) ?? "")) {
            await this.connections.writeSecret(found.id, key, sha256(key))
        }
        if (Object.keys(facts).length > 0) {
            await this.connections.patch(actor.workspaceId, found.id, { meta: { ...found.meta, ...facts } })
        }
    }

    private async payos(actor: ConnectionActor, seed: SeedPayos): Promise<SeededConnection> {
        const keys = payosKeysOf(seed)
        const plain = keys === undefined ? EMPTY_CREDENTIAL : JSON.stringify(keys)
        const found = await this.connections.find(actor.workspaceId, seed.id)
        if (found === null) {
            await this.create(actor, {
                id: seed.id,
                provider: "payos",
                name: "payOS",
                meta: {},
                plain,
                webhookSecret: randomSecret(),
            })
        } else if (keys !== undefined && (await this.storedOf(seed.id)) !== plain) {
            await this.connections.writeSecret(seed.id, plain)
        }
        return outcomeOf("payos", seed.id, found, keys !== undefined)
    }

    private async create(actor: ConnectionActor, newcomer: Newcomer): Promise<void> {
        await this.connections.create({
            id: newcomer.id,
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: newcomer.provider,
            name: newcomer.name,
            status: "pending",
            environment: "live",
            meta: newcomer.meta,
            secret: { plain: newcomer.plain, webhookSecret: newcomer.webhookSecret },
        })
    }

    private async storedOf(connectionId: string): Promise<string | undefined> {
        return (await this.connections.readSecret(connectionId))?.plain
    }
}

import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { parseJsonText } from "@modules/platform/primitives"
import { ConnectionApiTokenService } from "@modules/domain/connection-secrets"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { ConnectionReadyEvent } from "@modules/events/api"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { ChannelSeed } from "./channel-seed.contracts"
import { ChannelSeedService } from "./channel-seed.service"
import {
    BARE_SEED,
    FULL_SEED,
    SEED_ACTOR,
    SEED_IDS,
    SEED_SEPAY_API_TOKEN,
    SEED_SEPAY_KEY,
    SEED_TELEGRAM_TOKEN,
    seededRecordOf,
} from "@tests/fixtures/builders/channel-connections.builder"

const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex")

/** The rows that already exist, and what the sealed credential of each reads. */
interface Held {
    readonly rows?: ReadonlyArray<ConnectionRecord>
    readonly secrets?: Readonly<Record<string, string>>
}

const build = async (held: Held = {}) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockImplementation((_workspaceId, id) =>
        Promise.resolve(held.rows?.find((row) => row.id === id) ?? null),
    )
    connections.readSecret.mockImplementation((id) => {
        const plain = held.secrets?.[id]
        return Promise.resolve(plain === undefined ? null : { plain, webhookSecret: "hook", sealedAt: "now" })
    })
    connections.create.mockImplementation((input) => Promise.resolve(input.id ?? "generated"))
    const apiTokens = mock<ConnectionApiTokenService>()
    apiTokens.write.mockResolvedValue(true)
    const tx = fakeTransaction(mockEntityManager())
    const bus = recordingEventBus<ConnectionReadyEvent>()
    const publish = jest.spyOn(bus, "publish")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelSeedService,
            { provide: ConnectionsService, useValue: connections },
            { provide: ConnectionApiTokenService, useValue: apiTokens },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: EVENT_BUS, useValue: bus },
        ],
    }).compile()
    return { service: moduleRef.get(ChannelSeedService), connections, apiTokens, publish, tx }
}

const createdWith = (connections: jest.Mocked<ConnectionsService>, id: string) =>
    connections.create.mock.calls.map(([input]) => input).find((input) => input.id === id)

const HELD_ROWS = [
    seededRecordOf(SEED_IDS.telegram, "telegram"),
    seededRecordOf(SEED_IDS.zaloOa, "zalo_oa"),
    seededRecordOf(SEED_IDS.sepay, "sepay", { note: "kept" }),
    seededRecordOf(SEED_IDS.payos, "payos"),
]
/** A workspace that holds the four connections and their credentials. */
const held: Held = {
    rows: HELD_ROWS,
    secrets: {
        [SEED_IDS.telegram]: SEED_TELEGRAM_TOKEN,
        [SEED_IDS.zaloOa]: JSON.stringify({ appId: "1234567", appSecret: "app-secret-1", oaSecret: "oa-secret-1" }),
        [SEED_IDS.sepay]: SEED_SEPAY_KEY,
        [SEED_IDS.payos]: JSON.stringify({ clientId: "client", apiKey: "payos-key-1", checksumKey: "checksum-1" }),
    },
}

const WITH_GOOGLE: ChannelSeed = { ...BARE_SEED, google: { id: SEED_IDS.google, clientId: "client-id.apps.test", clientSecret: "client-secret-1" } }
const CLIENT = JSON.stringify({ oauth_client_id: "client-id.apps.test", oauth_client_secret: "client-secret-1" })

/** The value a sealed JSON credential reads back as; undefined when it is no JSON. */
const jsonOf = (text: string | undefined): unknown => {
    const read = parseJsonText(text ?? "")
    return read.ok ? read.value : undefined
}

describe("ChannelSeedService > a workspace without the connections", () => {
    it("creates the four under their fixed ids, pending, with every credential sealed", async () => {
        const { service, connections } = await build()

        await expect(service.ensure(SEED_ACTOR, FULL_SEED)).resolves.toEqual([
            { provider: "telegram", id: SEED_IDS.telegram, action: "created", credentials: "saved" },
            { provider: "zalo_oa", id: SEED_IDS.zaloOa, action: "created", credentials: "saved" },
            { provider: "sepay", id: SEED_IDS.sepay, action: "created", credentials: "saved" },
            { provider: "payos", id: SEED_IDS.payos, action: "created", credentials: "saved" },
        ])

        expect(connections.create).toHaveBeenCalledTimes(4)
        for (const [input] of connections.create.mock.calls) {
            expect(input).toMatchObject({ workspaceId: "ws-1", createdBy: "owner-1", status: "pending" })
        }
        expect(createdWith(connections, SEED_IDS.telegram)?.secret.plain).toBe(SEED_TELEGRAM_TOKEN)
        expect(jsonOf(createdWith(connections, SEED_IDS.payos)?.secret.plain)).toEqual({
            clientId: "client",
            apiKey: "payos-key-1",
            checksumKey: "checksum-1",
        })
    })

    it("stores a supplied SePay key as a generated one is stored: the key sealed, its hash as the webhook secret", async () => {
        const { service, connections } = await build()

        await service.ensure(SEED_ACTOR, FULL_SEED)

        const sepay = createdWith(connections, SEED_IDS.sepay)
        expect(sepay?.secret).toEqual({ plain: SEED_SEPAY_KEY, webhookSecret: hashOf(SEED_SEPAY_KEY) })
        expect(sepay?.meta).toEqual({ bank_code: "VCB", account_holder: "NIVO", account_masked: "•••• 6789", account_number: "0123456789" })
    })

    it("seals the SePay API token apart from the webhook key, and only when the seed gives one", async () => {
        const { service, apiTokens } = await build()

        await service.ensure(SEED_ACTOR, FULL_SEED)
        await service.ensure(SEED_ACTOR, BARE_SEED)

        expect(apiTokens.write).toHaveBeenCalledTimes(1)
        expect(apiTokens.write).toHaveBeenCalledWith(SEED_IDS.sepay, SEED_SEPAY_API_TOKEN)
    })
})

describe("ChannelSeedService > a workspace without the connections, the SePay feed", () => {
    it("announces the feed as ready once the API token is stored, so the first poll runs at once", async () => {
        const { service, publish, tx } = await build()

        await service.ensure(SEED_ACTOR, FULL_SEED)

        expect(publish).toHaveBeenCalledTimes(1)
        const [event] = publish.mock.calls[0] ?? []
        expect(Object.keys(event?.payload ?? {}).sort()).toEqual(["connectionId", "dedupeKey", "provider", "workspaceId"])
        expect(event?.payload).toMatchObject({ workspaceId: "ws-1", connectionId: SEED_IDS.sepay, provider: "sepay" })
        expect(event?.payload.dedupeKey).toMatch(new RegExp(`^${SEED_IDS.sepay}:api_token:[0-9a-f]{16}$`, "u"))
        expect(JSON.stringify(event)).not.toContain(SEED_SEPAY_API_TOKEN)
        expect(tx.commits).toBe(1)
    })

    it("announces nothing when no token is stored", async () => {
        const { service, apiTokens, publish } = await build()
        apiTokens.write.mockResolvedValue(false)

        await service.ensure(SEED_ACTOR, FULL_SEED)
        await service.ensure(SEED_ACTOR, BARE_SEED)

        expect(publish).not.toHaveBeenCalled()
    })

    it("generates a SePay key only when none is supplied", async () => {
        const { service, connections } = await build()

        const [, , sepay] = await service.ensure(SEED_ACTOR, BARE_SEED)

        const secret = createdWith(connections, SEED_IDS.sepay)?.secret
        expect(sepay).toMatchObject({ credentials: "missing" })
        expect(secret?.plain).toMatch(/^nivo_[0-9a-f]{64}$/u)
        expect(secret?.webhookSecret).toBe(hashOf(secret?.plain ?? ""))
    })
})

describe("ChannelSeedService > a workspace without the connections, the placeholders", () => {
    it("leaves the Zalo OA secret out, and says so, when its value is a PENDING- placeholder", async () => {
        const { service, connections } = await build()

        const [, zalo] = await service.ensure(SEED_ACTOR, { ...FULL_SEED, zaloOa: { ...FULL_SEED.zaloOa, oaSecret: "PENDING-until-zalo-issues-it" } })

        const created = createdWith(connections, SEED_IDS.zaloOa)
        expect(zalo).toMatchObject({ credentials: "missing" })
        expect(created?.meta).toEqual({ app_id: "1234567", oa_secret_saved: "false" })
        expect(jsonOf(created?.secret.plain)).toEqual({ appId: "1234567", appSecret: "app-secret-1", oaSecret: "" })
        expect(created?.secret.plain).not.toContain("PENDING")
    })

    const PENDING = "PENDING-SET-AFTER-DOMAIN-VERIFY"

    it("treats a PENDING- Zalo app id and app secret as unset, never refusing the run", async () => {
        const { service, connections } = await build()

        const [, zalo] = await service.ensure(SEED_ACTOR, { ...FULL_SEED, zaloOa: { ...FULL_SEED.zaloOa, appId: PENDING, appSecret: PENDING } })

        const created = createdWith(connections, SEED_IDS.zaloOa)
        expect(zalo).toMatchObject({ credentials: "missing" })
        expect(created?.meta).toEqual({ oa_secret_saved: "true" })
        expect(created?.secret.plain).not.toContain("PENDING")
    })

    it("creates every connection without credentials when none are supplied", async () => {
        const { service, connections } = await build()

        const seeded = await service.ensure(SEED_ACTOR, BARE_SEED)

        expect(seeded.map((entry) => entry.credentials)).toEqual(["missing", "missing", "missing", "missing"])
        expect(createdWith(connections, SEED_IDS.telegram)?.secret.plain).toBe("{}")
        expect(createdWith(connections, SEED_IDS.payos)?.secret.plain).toBe("{}")
        expect(createdWith(connections, SEED_IDS.zaloOa)?.meta).toEqual({ oa_secret_saved: "false" })
        expect(createdWith(connections, SEED_IDS.sepay)?.meta).toEqual({})
    })
})

describe("ChannelSeedService > a workspace that has them", () => {
    it("creates nothing and rewrites nothing when the credentials are the same", async () => {
        const { service, connections } = await build(held)

        const seeded = await service.ensure(SEED_ACTOR, FULL_SEED)

        expect(seeded.map((entry) => entry.action)).toEqual(["kept", "kept", "kept", "kept"])
        expect(connections.create).not.toHaveBeenCalled()
        expect(connections.writeSecret).not.toHaveBeenCalled()
    })

    it("keeps the SePay key it holds when the seed supplies none", async () => {
        const { service, connections } = await build(held)

        await service.ensure(SEED_ACTOR, BARE_SEED)

        expect(connections.writeSecret).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("takes new credentials into the same rows", async () => {
        const { service, connections } = await build(held)
        const next = ["nivo", "cd34".repeat(16)].join("_")
        const token = [SEED_TELEGRAM_TOKEN, "x"].join("")

        await service.ensure(SEED_ACTOR, {
            ...FULL_SEED,
            telegram: { id: SEED_IDS.telegram, token },
            sepay: { ...FULL_SEED.sepay, apiKey: next },
            payos: { ...FULL_SEED.payos, apiKey: "payos-key-2" },
        })

        expect(connections.writeSecret).toHaveBeenCalledWith(SEED_IDS.telegram, token)
        expect(connections.writeSecret).toHaveBeenCalledWith(SEED_IDS.sepay, next, hashOf(next))
        expect(connections.writeSecret).toHaveBeenCalledWith(
            SEED_IDS.payos,
            JSON.stringify({ clientId: "client", apiKey: "payos-key-2", checksumKey: "checksum-1" }),
        )
        const [, , sepayPatch] = connections.patch.mock.calls.find(([, id]) => id === SEED_IDS.sepay) ?? []
        expect(sepayPatch?.meta).toMatchObject({ note: "kept", bank_code: "VCB" })
        expect(connections.create).not.toHaveBeenCalled()
    })
})

describe("ChannelSeedService > a workspace that has them, the issued values", () => {
    it("keeps the tokens Zalo issued when the app values are written again", async () => {
        const issued = JSON.stringify({
            appId: "1234567",
            appSecret: "app-secret-1",
            oaSecret: "",
            accessToken: "access-1",
            renewalToken: "renewal-1",
        })
        const { service, connections } = await build({
            ...held,
            secrets: { ...held.secrets, [SEED_IDS.zaloOa]: issued },
        })

        await service.ensure(SEED_ACTOR, FULL_SEED)

        expect(connections.writeSecret).toHaveBeenCalledTimes(1)
        const [id, written] = connections.writeSecret.mock.calls[0] ?? []
        expect(id).toBe(SEED_IDS.zaloOa)
        expect(jsonOf(written)).toEqual({
            appId: "1234567",
            appSecret: "app-secret-1",
            oaSecret: "oa-secret-1",
            accessToken: "access-1",
            renewalToken: "renewal-1",
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", SEED_IDS.zaloOa, {
            meta: { app_id: "1234567", oa_secret_saved: "true" },
        })
    })

    it("does not write a PENDING- OA secret over the one the row holds", async () => {
        const { service, connections } = await build(held)

        await service.ensure(SEED_ACTOR, { ...FULL_SEED, zaloOa: { ...FULL_SEED.zaloOa, oaSecret: "PENDING-later" } })

        expect(connections.writeSecret).not.toHaveBeenCalled()
    })
})

describe("ChannelSeedService > a workspace whose rows hold no credential", () => {
    const bare: Held = { rows: HELD_ROWS }

    it("seals the Telegram token into a row that holds none", async () => {
        const { service, connections } = await build(bare)

        await service.ensure(SEED_ACTOR, {
            ...BARE_SEED,
            telegram: { id: SEED_IDS.telegram, token: SEED_TELEGRAM_TOKEN },
        })

        expect(connections.writeSecret.mock.calls.filter(([id]) => id === SEED_IDS.telegram)).toEqual([
            [SEED_IDS.telegram, SEED_TELEGRAM_TOKEN],
        ])
    })

    it("seals the SePay key and its hash into a row that holds none", async () => {
        const { service, connections } = await build(bare)

        await service.ensure(SEED_ACTOR, { ...BARE_SEED, sepay: { id: SEED_IDS.sepay, apiKey: SEED_SEPAY_KEY } })

        expect(connections.writeSecret.mock.calls.filter(([id]) => id === SEED_IDS.sepay)).toEqual([
            [SEED_IDS.sepay, SEED_SEPAY_KEY, hashOf(SEED_SEPAY_KEY)],
        ])
    })

    it("writes the Zalo values given beside empty ones into a row that holds no credential", async () => {
        const { service, connections } = await build(bare)

        await service.ensure(SEED_ACTOR, { ...BARE_SEED, zaloOa: { id: SEED_IDS.zaloOa, appId: "1234567" } })

        const [id, written] = connections.writeSecret.mock.calls.find(([each]) => each === SEED_IDS.zaloOa) ?? []
        expect(id).toBe(SEED_IDS.zaloOa)
        expect(jsonOf(written)).toEqual({ appId: "1234567", appSecret: "", oaSecret: "" })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", SEED_IDS.zaloOa, {
            meta: { app_id: "1234567", oa_secret_saved: "false" },
        })
    })

    it("keeps the values a Zalo row holds for the ones the seed leaves out", async () => {
        const stored = JSON.stringify({ appId: "7654321", appSecret: "app-secret-9", oaSecret: "oa-secret-9" })
        const { service, connections } = await build({ rows: HELD_ROWS, secrets: { [SEED_IDS.zaloOa]: stored } })

        await service.ensure(SEED_ACTOR, { ...BARE_SEED, zaloOa: { id: SEED_IDS.zaloOa } })

        expect(connections.writeSecret).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })
})

describe("ChannelSeedService > a seed that is malformed", () => {
    const refused = (field: string) =>
        new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

    it.each([
        ["telegram.token", { ...BARE_SEED, telegram: { id: SEED_IDS.telegram, token: "not-a-token" } }, 0],
        ["zalo.appId", { ...BARE_SEED, zaloOa: { id: SEED_IDS.zaloOa, appId: "abc" } }, 1],
        ["sepay.apiKey", { ...BARE_SEED, sepay: { id: SEED_IDS.sepay, apiKey: "short" } }, 2],
        ["payos", { ...BARE_SEED, payos: { id: SEED_IDS.payos, clientId: "client" } }, 3],
    ])("refuses %s by name before it writes that connection", async (field, seed, written) => {
        const { service, connections } = await build()

        await expect(service.ensure(SEED_ACTOR, seed)).rejects.toEqual(refused(field))
        expect(connections.create).toHaveBeenCalledTimes(written)
    })
})

describe("ChannelSeedService > the Google connection", () => {
    it("seeds none when the OAuth client is not given, and fails nothing", async () => {
        const { service, connections } = await build()

        const seeded = await service.ensure(SEED_ACTOR, BARE_SEED)
        await service.ensure(SEED_ACTOR, { ...BARE_SEED, google: { id: SEED_IDS.google } })

        expect(seeded.map((one) => one.provider)).not.toContain("google")
        expect(createdWith(connections, SEED_IDS.google)).toBeUndefined()
    })

    it("creates it pending with no token, and says the owner has not consented yet", async () => {
        const { service, connections } = await build()

        const seeded = await service.ensure(SEED_ACTOR, WITH_GOOGLE)

        expect(seeded.at(-1)).toEqual({
            provider: "google",
            id: SEED_IDS.google,
            action: "created",
            credentials: "saved",
            consent: "needed",
        })
        const made = createdWith(connections, SEED_IDS.google)
        expect(made).toMatchObject({
            provider: "google",
            status: "pending",
            meta: { oauth_client_id: "client-id.apps.test", consent: "needed" },
        })
        expect(made?.secret.plain).toBe(CLIENT)
        expect(made?.secret.plain).not.toContain("access_token")
        expect(made?.secret.plain).not.toContain("renewal_token")
    })

    it("keeps a connection the owner consented to untouched, token and all", async () => {
        const { service, connections } = await build({
            rows: [
                seededRecordOf(SEED_IDS.google, "google", {
                    email: "owner@nivo.test",
                    oauth_client_id: "client-id.apps.test",
                }),
            ],
            secrets: { [SEED_IDS.google]: JSON.stringify({ access_token: "a", renewal_token: "r", expires_at: 1 }) },
        })

        const seeded = await service.ensure(SEED_ACTOR, WITH_GOOGLE)

        expect(seeded.at(-1)).toMatchObject({ provider: "google", action: "kept", consent: "given" })
        expect(createdWith(connections, SEED_IDS.google)).toBeUndefined()
        expect(connections.writeSecret).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })
})

describe("ChannelSeedService > the Google connection, a new client", () => {
    it("takes a new OAuth client into the connection that still waits for consent", async () => {
        const waiting = {
            ...seededRecordOf(SEED_IDS.google, "google", { oauth_client_id: "old", consent: "needed" }),
            status: "pending" as const,
        }
        const { service, connections } = await build({
            rows: [waiting],
            secrets: {
                [SEED_IDS.google]: JSON.stringify({ oauth_client_id: "old", oauth_client_secret: "old-secret" }),
            },
        })

        const seeded = await service.ensure(SEED_ACTOR, WITH_GOOGLE)

        expect(seeded.at(-1)).toMatchObject({ action: "kept", consent: "needed" })
        expect(connections.writeSecret).toHaveBeenCalledWith(SEED_IDS.google, CLIENT)
        expect(connections.patch).toHaveBeenCalledWith("ws-1", SEED_IDS.google, {
            meta: { oauth_client_id: "client-id.apps.test", consent: "needed" },
        })
    })

    it("refuses a half client by the name of the field", async () => {
        const { service } = await build()

        await expect(
            service.ensure(SEED_ACTOR, {
                ...BARE_SEED,
                google: { id: SEED_IDS.google, clientId: "client-id.apps.test" },
            }),
        ).rejects.toEqual(
            new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "google" } }),
        )
    })
})

describe("ChannelSeedService > the Telegram webhook secret sealed by name", () => {
    const HOOK = "dev_hook-0123456789abcdef"

    it("creates the bot with the seeded secret, so a dev mock can prove its deliveries", async () => {
        const { service, connections } = await build()

        await service.ensure(SEED_ACTOR, {
            ...BARE_SEED,
            telegram: { id: SEED_IDS.telegram, token: SEED_TELEGRAM_TOKEN, webhookSecret: HOOK },
        })

        expect(createdWith(connections, SEED_IDS.telegram)?.secret).toMatchObject({
            plain: SEED_TELEGRAM_TOKEN,
            webhookSecret: HOOK,
        })
    })

    it("writes a new secret into the row with the token it holds, and nothing when both are the same", async () => {
        const changed = await build(held)
        await changed.service.ensure(SEED_ACTOR, {
            ...FULL_SEED,
            telegram: { id: SEED_IDS.telegram, webhookSecret: HOOK },
        })
        expect(changed.connections.writeSecret).toHaveBeenCalledWith(SEED_IDS.telegram, SEED_TELEGRAM_TOKEN, HOOK)

        const same = await build(held)
        await same.service.ensure(SEED_ACTOR, {
            ...FULL_SEED,
            telegram: { id: SEED_IDS.telegram, token: SEED_TELEGRAM_TOKEN, webhookSecret: "hook" },
        })
        expect(same.connections.writeSecret).not.toHaveBeenCalledWith(
            SEED_IDS.telegram,
            expect.anything(),
            expect.anything(),
        )
        expect(same.connections.writeSecret).not.toHaveBeenCalledWith(SEED_IDS.telegram, expect.anything())
    })

    it("refuses a secret Telegram would not take, by the field's name only", async () => {
        const { service, connections } = await build()

        await expect(
            service.ensure(SEED_ACTOR, {
                ...BARE_SEED,
                telegram: { id: SEED_IDS.telegram, webhookSecret: "has spaces!" },
            }),
        ).rejects.toMatchObject({ params: { field: "telegram.webhookSecret" } })
        expect(connections.create).not.toHaveBeenCalled()
    })
})

import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { ChannelSeed } from "./channel-seed.contracts"
import { ChannelSeedService } from "./channel-seed.service"

const ACTOR = { principalId: "owner-1", workspaceId: "ws-1" }
const IDS = {
    sepay: "44c471c0-1a75-42e2-ac4b-09dded78c263",
    payos: "103ceb10-102c-4904-9ce4-d9c1b03ddcef",
    zaloOa: "ff2e59dc-5ed2-4327-8a73-ca3526bc3b6f",
    telegram: "72f2699d-7f93-45e1-964a-8a2228137985",
}
const TOKEN = ["123456789", "AAEabcdefghijklmnopqrstuvwxyz012345"].join(":")
const SEPAY_KEY = ["nivo", "ab12".repeat(16)].join("_")
/** The JSON a stored credential holds. */
const jsonOf = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch (cause) {
        throw new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "secret" }, cause })
    }
}
const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex")

const BARE: ChannelSeed = {
    telegram: { id: IDS.telegram },
    zaloOa: { id: IDS.zaloOa },
    sepay: { id: IDS.sepay },
    payos: { id: IDS.payos },
}
const FULL: ChannelSeed = {
    telegram: { id: IDS.telegram, token: TOKEN },
    zaloOa: { id: IDS.zaloOa, appId: "1234567", appSecret: "app-secret-1", oaSecret: "oa-secret-1" },
    sepay: { id: IDS.sepay, bankCode: "vcb", accountNumber: "0123456789", holder: "nivo", apiKey: SEPAY_KEY },
    payos: { id: IDS.payos, clientId: "client", apiKey: "payos-key-1", checksumKey: "checksum-1" },
}

const recordOf = (id: string, provider: ConnectionRecord["provider"], meta = {}): ConnectionRecord => ({
    id,
    workspaceId: ACTOR.workspaceId,
    provider,
    name: provider,
    meta,
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: ACTOR.principalId,
    createdAt: "2026-11-03T00:00:00.000Z",
})

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
    const moduleRef = await Test.createTestingModule({
        providers: [ChannelSeedService, { provide: ConnectionsService, useValue: connections }],
    }).compile()
    return { service: moduleRef.get(ChannelSeedService), connections }
}

const createdWith = (connections: jest.Mocked<ConnectionsService>, id: string) =>
    connections.create.mock.calls.map(([input]) => input).find((input) => input.id === id)

describe("ChannelSeedService > a workspace without the connections", () => {
    it("creates the four under their fixed ids, pending, with every credential sealed", async () => {
        const { service, connections } = await build()

        await expect(service.ensure(ACTOR, FULL)).resolves.toEqual([
            { provider: "telegram", id: IDS.telegram, action: "created", credentials: "saved" },
            { provider: "zalo_oa", id: IDS.zaloOa, action: "created", credentials: "saved" },
            { provider: "sepay", id: IDS.sepay, action: "created", credentials: "saved" },
            { provider: "payos", id: IDS.payos, action: "created", credentials: "saved" },
        ])

        expect(connections.create).toHaveBeenCalledTimes(4)
        for (const [input] of connections.create.mock.calls) {
            expect(input).toMatchObject({ workspaceId: "ws-1", createdBy: "owner-1", status: "pending" })
        }
        expect(createdWith(connections, IDS.telegram)?.secret.plain).toBe(TOKEN)
        expect(jsonOf(createdWith(connections, IDS.payos)?.secret.plain ?? "")).toEqual({
            clientId: "client",
            apiKey: "payos-key-1",
            checksumKey: "checksum-1",
        })
    })

    it("stores a supplied SePay key as a generated one is stored: the key sealed, its hash as the webhook secret", async () => {
        const { service, connections } = await build()

        await service.ensure(ACTOR, FULL)

        const sepay = createdWith(connections, IDS.sepay)
        expect(sepay?.secret).toEqual({ plain: SEPAY_KEY, webhookSecret: hashOf(SEPAY_KEY) })
        expect(sepay?.meta).toEqual({
            bank_code: "VCB",
            account_holder: "NIVO",
            account_masked: "•••• 6789",
            account_number: "0123456789",
        })
    })

    it("generates a SePay key only when none is supplied", async () => {
        const { service, connections } = await build()

        const [, , sepay] = await service.ensure(ACTOR, BARE)

        const secret = createdWith(connections, IDS.sepay)?.secret
        expect(sepay).toMatchObject({ credentials: "missing" })
        expect(secret?.plain).toMatch(/^nivo_[0-9a-f]{64}$/u)
        expect(secret?.webhookSecret).toBe(hashOf(secret?.plain ?? ""))
    })

    it("leaves the Zalo OA secret out, and says so, when its value is a PENDING- placeholder", async () => {
        const { service, connections } = await build()

        const [, zalo] = await service.ensure(ACTOR, {
            ...FULL,
            zaloOa: { ...FULL.zaloOa, oaSecret: "PENDING-until-zalo-issues-it" },
        })

        const created = createdWith(connections, IDS.zaloOa)
        expect(zalo).toMatchObject({ credentials: "missing" })
        expect(created?.meta).toEqual({ app_id: "1234567", oa_secret_saved: "false" })
        expect(jsonOf(created?.secret.plain ?? "")).toEqual({
            appId: "1234567",
            appSecret: "app-secret-1",
            oaSecret: "",
        })
        expect(created?.secret.plain).not.toContain("PENDING")
    })

    it("creates every connection without credentials when none are supplied", async () => {
        const { service, connections } = await build()

        const seeded = await service.ensure(ACTOR, BARE)

        expect(seeded.map((entry) => entry.credentials)).toEqual(["missing", "missing", "missing", "missing"])
        expect(createdWith(connections, IDS.telegram)?.secret.plain).toBe("{}")
        expect(createdWith(connections, IDS.payos)?.secret.plain).toBe("{}")
        expect(createdWith(connections, IDS.zaloOa)?.meta).toEqual({ oa_secret_saved: "false" })
        expect(createdWith(connections, IDS.sepay)?.meta).toEqual({})
    })
})

const HELD_ROWS = [
    recordOf(IDS.telegram, "telegram"),
    recordOf(IDS.zaloOa, "zalo_oa"),
    recordOf(IDS.sepay, "sepay", { note: "kept" }),
    recordOf(IDS.payos, "payos"),
]
const HELD: Held = {
    rows: HELD_ROWS,
    secrets: {
        [IDS.telegram]: TOKEN,
        [IDS.zaloOa]: JSON.stringify({ appId: "1234567", appSecret: "app-secret-1", oaSecret: "oa-secret-1" }),
        [IDS.sepay]: SEPAY_KEY,
        [IDS.payos]: JSON.stringify({ clientId: "client", apiKey: "payos-key-1", checksumKey: "checksum-1" }),
    },
}

describe("ChannelSeedService > a workspace that has them", () => {
    it("creates nothing and rewrites nothing when the credentials are the same", async () => {
        const { service, connections } = await build(HELD)

        const seeded = await service.ensure(ACTOR, FULL)

        expect(seeded.map((entry) => entry.action)).toEqual(["kept", "kept", "kept", "kept"])
        expect(connections.create).not.toHaveBeenCalled()
        expect(connections.writeSecret).not.toHaveBeenCalled()
    })

    it("keeps the SePay key it holds when the seed supplies none", async () => {
        const { service, connections } = await build(HELD)

        await service.ensure(ACTOR, BARE)

        expect(connections.writeSecret).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })
})

describe("ChannelSeedService > a workspace that has them, given new credentials", () => {
    it("takes new credentials into the same rows", async () => {
        const { service, connections } = await build(HELD)
        const next = ["nivo", "cd34".repeat(16)].join("_")
        const token = [TOKEN, "x"].join("")

        await service.ensure(ACTOR, {
            ...FULL,
            telegram: { id: IDS.telegram, token },
            sepay: { ...FULL.sepay, apiKey: next },
            payos: { ...FULL.payos, apiKey: "payos-key-2" },
        })

        expect(connections.writeSecret).toHaveBeenCalledWith(IDS.telegram, token)
        expect(connections.writeSecret).toHaveBeenCalledWith(IDS.sepay, next, hashOf(next))
        expect(connections.writeSecret).toHaveBeenCalledWith(
            IDS.payos,
            JSON.stringify({ clientId: "client", apiKey: "payos-key-2", checksumKey: "checksum-1" }),
        )
        const [workspaceId, id, change] = connections.patch.mock.calls[0] ?? []
        expect([workspaceId, id]).toEqual(["ws-1", IDS.sepay])
        expect(change?.meta).toMatchObject({ note: "kept", bank_code: "VCB" })
        expect(connections.create).not.toHaveBeenCalled()
    })

    it("keeps the tokens Zalo issued when the app values are written again", async () => {
        const issued = JSON.stringify({
            appId: "1234567",
            appSecret: "app-secret-1",
            oaSecret: "",
            accessToken: "access-1",
            renewalToken: "renewal-1",
        })
        const { service, connections } = await build({ ...HELD, secrets: { ...HELD.secrets, [IDS.zaloOa]: issued } })

        await service.ensure(ACTOR, FULL)

        expect(connections.writeSecret).toHaveBeenCalledTimes(1)
        const written = connections.writeSecret.mock.calls[0]
        expect(written?.[0]).toBe(IDS.zaloOa)
        expect(jsonOf(written?.[1] ?? "")).toEqual({
            appId: "1234567",
            appSecret: "app-secret-1",
            oaSecret: "oa-secret-1",
            accessToken: "access-1",
            renewalToken: "renewal-1",
        })
        expect(connections.patch).toHaveBeenCalledWith("ws-1", IDS.zaloOa, {
            meta: { app_id: "1234567", oa_secret_saved: "true" },
        })
    })

    it("does not write a PENDING- OA secret over the one the row holds", async () => {
        const { service, connections } = await build(HELD)

        await service.ensure(ACTOR, { ...FULL, zaloOa: { ...FULL.zaloOa, oaSecret: "PENDING-later" } })

        expect(connections.writeSecret).not.toHaveBeenCalled()
    })
})

describe("ChannelSeedService > a workspace whose rows hold no credential yet", () => {
    const EMPTY: Held = { rows: HELD_ROWS }

    it("writes the Telegram token and the SePay key given, since nothing is stored to equal them", async () => {
        const { service, connections } = await build(EMPTY)

        await service.ensure(ACTOR, FULL)

        expect(connections.writeSecret).toHaveBeenCalledWith(IDS.telegram, TOKEN)
        expect(connections.writeSecret).toHaveBeenCalledWith(IDS.sepay, SEPAY_KEY, hashOf(SEPAY_KEY))
    })

    it("seals the Zalo values given as the whole credential", async () => {
        const { service, connections } = await build(EMPTY)

        await service.ensure(ACTOR, FULL)

        const written = connections.writeSecret.mock.calls.find(([id]) => id === IDS.zaloOa)
        expect(jsonOf(written?.[1] ?? "")).toEqual({
            appId: "1234567",
            appSecret: "app-secret-1",
            oaSecret: "oa-secret-1",
        })
    })

    it("seals empty Zalo values when the seed gives none", async () => {
        const { service, connections } = await build(EMPTY)

        await service.ensure(ACTOR, BARE)

        const written = connections.writeSecret.mock.calls.find(([id]) => id === IDS.zaloOa)
        expect(jsonOf(written?.[1] ?? "")).toEqual({ appId: "", appSecret: "", oaSecret: "" })
    })

    it("keeps the Zalo values the row holds for every one the seed leaves out", async () => {
        const { service, connections } = await build(HELD)

        await service.ensure(ACTOR, { ...BARE, zaloOa: { id: IDS.zaloOa, appId: "7654321" } })

        const written = connections.writeSecret.mock.calls.find(([id]) => id === IDS.zaloOa)
        expect(jsonOf(written?.[1] ?? "")).toEqual({
            appId: "7654321",
            appSecret: "app-secret-1",
            oaSecret: "oa-secret-1",
        })
    })
})

describe("ChannelSeedService > a seed that is malformed", () => {
    const refused = (field: string) =>
        new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

    it.each([
        ["telegram.token", { ...BARE, telegram: { id: IDS.telegram, token: "not-a-token" } }, 0],
        ["zalo.appId", { ...BARE, zaloOa: { id: IDS.zaloOa, appId: "abc" } }, 1],
        ["sepay.apiKey", { ...BARE, sepay: { id: IDS.sepay, apiKey: "short" } }, 2],
        ["payos", { ...BARE, payos: { id: IDS.payos, clientId: "client" } }, 3],
    ])("refuses %s by name before it writes that connection", async (field, seed, written) => {
        const { service, connections } = await build()

        await expect(service.ensure(ACTOR, seed)).rejects.toEqual(refused(field))
        expect(connections.create).toHaveBeenCalledTimes(written)
    })
})

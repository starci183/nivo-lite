import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AccountDataIntakeService, AccountDataReadService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { DoorProviderReadsService } from "./door-provider-reads.service"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import { INTERFACE_SNAPSHOT_TYPE } from "./interface.data-types"
import { interfaceCallOf, snapshotKeyOf, snapshotVerbOf } from "./provider-read-store.policy"
import type { InterfaceProviderAnswer, InterfaceReadProvider } from "./provider-reads.contracts"
import { mayReadProvider, providerReadNameOf } from "./provider-reads.policy"
import type { DoorCall } from "./workbench-door.contracts"
import { INTERFACE_READ_PROVIDERS } from "./workbench-door.decorators"
import { WorkbenchDoorLogEvent } from "./workbench-door.log-events"

const PAGE: InterfaceProviderAnswer = { kind: "page", rows: [{ code: "ACME" }, { code: "BETA" }], cursor: "c2", truncated: false, omitted: 0 }
const callOf = (name: string, payload = '{"q":"an"}'): DoorCall => ({ workspaceId: "ws-1", name, payload, locale: "vi" })

const build = async (withProviders = true) => {
    const logger = mock<Logger>()
    const provider = mock<InterfaceReadProvider>({ provider: "openapi" })
    provider.readsOf.mockResolvedValue([{ name: "nivo.api.crm.nivoweb.get.customers", shape: "page", input: { type: "object" }, output: null }])
    provider.read.mockResolvedValue(PAGE)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DoorProviderReadsService,
            { provide: LOGGER, useValue: logger },
            ...(withProviders ? [{ provide: INTERFACE_READ_PROVIDERS, useValue: [provider] }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(DoorProviderReadsService), provider, logger }
}

describe("DoorProviderReadsService", () => {
    it("dispatches by provider and read name, hands the input to the provider and answers its page as JSON text", async () => {
        const { service, provider } = await build()

        const answer = await service.read("member-1", callOf("openapi:nivo.api.crm.nivoweb.get.customers"))

        expect(provider.readsOf).toHaveBeenCalledWith("ws-1")
        expect(provider.read).toHaveBeenCalledWith({ workspaceId: "ws-1", memberId: "member-1" }, "nivo.api.crm.nivoweb.get.customers", { q: "an" })
        expect(parseJsonText(answer.data)).toMatchObject({ ok: true, value: PAGE })
    })

    it("audits a person's read with ids and a row count, never the rows", async () => {
        const { service, logger } = await build()

        await service.read("member-1", callOf("openapi:nivo.api.crm.nivoweb.get.customers"))

        expect(logger.info).toHaveBeenCalledWith(WorkbenchDoorLogEvent.ProviderRead, {
            workspaceId: "ws-1",
            memberId: "member-1",
            provider: "openapi",
            read: "nivo.api.crm.nivoweb.get.customers",
            outcome: "page",
            rows: 2,
        })
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain("ACME")
    })

    it("refuses a provider that registered nothing, a read it does not offer this workspace and a payload that is no object", async () => {
        const { service, provider } = await build()
        const none = await build(false)

        await expect(service.read("member-1", callOf("sepay:transactions"))).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.ReadUnknown })
        await expect(service.read("member-1", callOf("openapi:crm.renewal.confirm"))).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.ReadUnknown })
        await expect(service.read("member-1", callOf("openapi:nivo.api.crm.nivoweb.get.customers", "[1]"))).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.PayloadInvalid })
        await expect(none.service.read("member-1", callOf("openapi:nivo.api.crm.nivoweb.get.customers"))).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.ReadUnknown })
        expect(provider.read).not.toHaveBeenCalled()
    })

    it("audits a failed read and hands the provider's own error on", async () => {
        const { service, provider, logger } = await build()
        provider.read.mockRejectedValue(new Error("document_changed"))

        await expect(service.read("member-1", callOf("openapi:nivo.api.crm.nivoweb.get.customers"))).rejects.toThrow("document_changed")
        expect(logger.info).toHaveBeenCalledWith(WorkbenchDoorLogEvent.ProviderRead, expect.objectContaining({ outcome: "failed", rows: 0 }))
    })
})

describe("DoorProviderReadsService info", () => {
    it("answers an account's current state as typed figures and audits the read", async () => {
        const { service, provider, logger } = await build()
        const figure = { key: "last_received", label: { vi: "a", en: "b" }, value: null, kind: "time" as const }
        const info = { connectionId: "c-1", state: "ok" as const, figures: [figure] }
        const infoOf = jest.fn().mockResolvedValueOnce(info).mockResolvedValueOnce(null)
        Object.assign(provider, { infoOf })

        const answer = await service.read("member-1", callOf("openapi:info", '{"connectionId":"c-1"}'))

        expect(infoOf).toHaveBeenCalledWith("ws-1", "c-1")
        expect(parseJsonText(answer.data)).toMatchObject({ ok: true, value: { kind: "info", ...info } })
        expect(logger.info).toHaveBeenCalledWith(
            WorkbenchDoorLogEvent.ProviderRead,
            expect.objectContaining({ read: "info", outcome: "info", rows: 1 }),
        )
        await expect(service.read("member-1", callOf("openapi:info", '{"connectionId":"c-9"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
        })
        await expect(service.read("member-1", callOf("openapi:info", "{}"))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.PayloadInvalid,
        })
    })
})

describe("DoorProviderReadsService API verbs", () => {
    it("answers an account's info named by its API verb exactly as by the old `<provider>:info`", async () => {
        const { service, provider } = await build()
        const info = { connectionId: "c-1", state: "ok" as const, figures: [] }
        const infoOf = jest.fn().mockResolvedValue(info)
        Object.assign(provider, { infoOf })

        const byVerb = await service.read("member-1", callOf("nivo.api.openapi.info", '{"connectionId":"c-1"}'))
        const byOld = await service.read("member-1", callOf("openapi:info", '{"connectionId":"c-1"}'))

        expect(byVerb).toEqual(byOld)
        expect(infoOf).toHaveBeenCalledTimes(2)
    })

    it("runs a source's read named by its API verb with the verb as the read, the same as the stored `openapi:<verb>` binding", async () => {
        const { service, provider } = await build()
        provider.readsOf.mockResolvedValue([{ name: "nivo.api.crm.get.customers", shape: "page", input: { type: "object" }, output: null }])

        await service.read("member-1", callOf("nivo.api.crm.get.customers"))
        await service.read("member-1", callOf("openapi:nivo.api.crm.get.customers"))

        const viewer = { workspaceId: "ws-1", memberId: "member-1" }
        expect(provider.read).toHaveBeenNthCalledWith(1, viewer, "nivo.api.crm.get.customers", { q: "an" })
        expect(provider.read).toHaveBeenNthCalledWith(2, viewer, "nivo.api.crm.get.customers", { q: "an" })
    })

    it("serves no read of a core provider that API does not name, even when a provider registered a reader for it", async () => {
        const logger = mock<Logger>()
        const infoOf = jest.fn().mockResolvedValue({ connectionId: "c-1", state: "ok", figures: [] })
        const telegram = mock<InterfaceReadProvider>({ provider: "telegram", infoOf })
        telegram.readsOf.mockResolvedValue([{ name: "transactions", shape: "page", input: { type: "object" }, output: null }])
        const moduleRef = await Test.createTestingModule({
            providers: [
                DoorProviderReadsService,
                { provide: LOGGER, useValue: logger },
                { provide: INTERFACE_READ_PROVIDERS, useValue: [telegram] },
            ],
        }).compile()
        const service = moduleRef.get(DoorProviderReadsService)

        await expect(service.read("member-1", callOf("telegram:info", '{"connectionId":"c-1"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
        })
        await expect(service.read("member-1", callOf("telegram:transactions"))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
        })
        expect(infoOf).not.toHaveBeenCalled()
        expect(telegram.read).not.toHaveBeenCalled()
    })
})

describe("provider-reads.policy", () => {
    it("tells a provider read from a module read by its name, and lets every proven member read for now", () => {
        expect(providerReadNameOf("openapi:nivo.api.crm.nivoweb.get.customers")).toEqual({ provider: "openapi", read: "nivo.api.crm.nivoweb.get.customers" })
        expect(providerReadNameOf("sales.leads")).toBeNull()
        expect(providerReadNameOf("openapi:")).toBeNull()
        expect(mayReadProvider({ workspaceId: "ws-1", memberId: "member-1" }, { provider: "openapi", read: "nivo.api.crm.nivoweb.get.customers" })).toBe(true)
        expect(mayReadProvider({ workspaceId: "ws-1", memberId: "" }, { provider: "openapi", read: "nivo.api.crm.nivoweb.get.customers" })).toBe(false)
    })
})

const NOW = new Date("2026-11-12T04:00:00.000Z")
const STORED_AT = new Date("2026-11-12T03:59:30.000Z")
const CONNECTION = "c-1"
const ACCOUNT_READ = "openapi:nivo.api.crm.nivoweb.get.customers"
const ASKED = interfaceCallOf("openapi:nivo.api.crm.nivoweb.get.customers", { connectionId: CONNECTION, q: "an" })
const KEY = `${ASKED.verb}:${ASKED.argsHash}`

const storedRowOf = (answer: unknown) => ({
    id: "row-1",
    type: INTERFACE_SNAPSHOT_TYPE,
    typeVersion: 1,
    key: KEY,
    value: { verb: ASKED.verb, argsHash: ASKED.argsHash, status: "page", durationMs: 5, rows: 2, memberId: "member-0", answer },
    occurredAt: STORED_AT,
    processedAt: null,
})

const buildStored = async (owningWorkspace: string | null = "ws-1") => {
    const logger = mock<Logger>()
    const provider = mock<InterfaceReadProvider>({ provider: "openapi" })
    provider.readsOf.mockResolvedValue([{ name: "nivo.api.crm.nivoweb.get.customers", shape: "page", input: { type: "object" }, output: null }])
    provider.read.mockResolvedValue(PAGE)
    const reads = mock<AccountDataReadService>()
    reads.get.mockResolvedValue(null)
    const intake = mock<AccountDataIntakeService>()
    intake.write.mockResolvedValue({ owner: null, rows: [] })
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.workspaceOf.mockResolvedValue(owningWorkspace)
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DoorProviderReadsService,
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: INTERFACE_READ_PROVIDERS, useValue: [provider] },
            { provide: AccountDataReadService, useValue: reads },
            { provide: AccountDataIntakeService, useValue: intake },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
        ],
    }).compile()
    return { service: moduleRef.get(DoorProviderReadsService), provider, reads, intake, bindings, logger, tx }
}

const answerOf = (data: string): unknown => {
    const parsed = parseJsonText(data)
    return parsed.ok ? parsed.value : null
}

describe("DoorProviderReadsService stored answers", () => {
    it("answers a read of an account of the caller's workspace from its snapshot, synced as of the store, without the provider", async () => {
        const { service, provider, reads, intake, bindings, logger } = await buildStored()
        reads.get.mockResolvedValue(storedRowOf(PAGE))

        const answer = await service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1","q":"an"}'))

        expect(bindings.workspaceOf).toHaveBeenCalledWith(CONNECTION, expect.anything())
        expect(reads.get).toHaveBeenCalledWith(CONNECTION, INTERFACE_SNAPSHOT_TYPE, KEY)
        expect(answerOf(answer.data)).toEqual({ ...PAGE, source: "synced", asOf: STORED_AT.toISOString() })
        expect(provider.read).not.toHaveBeenCalled()
        expect(intake.write).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(
            WorkbenchDoorLogEvent.ProviderRead,
            expect.objectContaining({ outcome: "page", rows: 2, from: "store" }),
        )
    })

    it("asks the provider when nothing usable is stored and stores the live answer under the same key in one transaction", async () => {
        const { service, provider, intake, tx } = await buildStored()

        const answer = await service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1","q":"an"}'))

        expect(provider.read).toHaveBeenCalledWith({ workspaceId: "ws-1", memberId: "member-1" }, "nivo.api.crm.nivoweb.get.customers", {
            connectionId: CONNECTION,
            q: "an",
        })
        expect(intake.write).toHaveBeenCalledWith(expect.anything(), CONNECTION, [
            {
                type: INTERFACE_SNAPSHOT_TYPE,
                value: {
                    verb: ASKED.verb,
                    argsHash: ASKED.argsHash,
                    status: "page",
                    durationMs: 0,
                    rows: 2,
                    memberId: "member-1",
                    answer: PAGE,
                },
            },
        ])
        expect(tx.outcomes).toEqual(["commit"])
        expect(answerOf(answer.data)).toMatchObject({ source: "live", asOf: NOW.toISOString() })
    })

    it("never serves nor stores a snapshot of a connection of another workspace: the live path decides", async () => {
        const { service, provider, reads, intake } = await buildStored("ws-other")
        reads.get.mockResolvedValue(storedRowOf(PAGE))

        const answer = await service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1","q":"an"}'))

        expect(reads.get).not.toHaveBeenCalled()
        expect(provider.read).toHaveBeenCalledTimes(1)
        expect(intake.write).not.toHaveBeenCalled()
        expect(answerOf(answer.data)).toMatchObject({ source: "live" })
    })

    it("asks the provider when the stored value is no page or record", async () => {
        const { service, provider, reads } = await buildStored()
        reads.get.mockResolvedValue(storedRowOf({ kind: "refused", code: "x", message: "y" }))

        await service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1","q":"an"}'))

        expect(provider.read).toHaveBeenCalledTimes(1)
    })
})

describe("DoorProviderReadsService stored answers: refresh and refusals", () => {
    it("forces a live read on fresh: true, never hands fresh to the provider and rewrites the snapshot", async () => {
        const { service, provider, reads, intake } = await buildStored()
        reads.get.mockResolvedValue(storedRowOf(PAGE))

        const answer = await service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1","q":"an","fresh":true}'))

        expect(reads.get).not.toHaveBeenCalled()
        expect(provider.read).toHaveBeenCalledWith(expect.anything(), "nivo.api.crm.nivoweb.get.customers", { connectionId: CONNECTION, q: "an" })
        const written = intake.write.mock.calls[0]?.[2][0]
        expect(intake.write.mock.calls[0]?.[1]).toBe(CONNECTION)
        expect(written?.type).toBe(INTERFACE_SNAPSHOT_TYPE)
        expect(written?.value).toMatchObject({ argsHash: ASKED.argsHash, answer: PAGE })
        expect(answerOf(answer.data)).toMatchObject({ source: "live" })
    })

    it("reads live and stores nothing for a read that names no account", async () => {
        const { service, provider, reads, intake } = await buildStored()

        await service.read("member-1", callOf(ACCOUNT_READ, '{"q":"an","fresh":true}'))

        expect(provider.read).toHaveBeenCalledWith(expect.anything(), "nivo.api.crm.nivoweb.get.customers", { q: "an" })
        expect(reads.get).not.toHaveBeenCalled()
        expect(intake.write).not.toHaveBeenCalled()
    })

    it("stores nothing when the live read fails or the provider refuses", async () => {
        const { service, provider, intake } = await buildStored()
        provider.read.mockRejectedValueOnce(new Error("upstream_down"))
        provider.read.mockResolvedValueOnce({ kind: "refused", code: "not_found", message: "no such account" })

        await expect(service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1"}'))).rejects.toThrow("upstream_down")
        await service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1"}'))

        expect(intake.write).not.toHaveBeenCalled()
    })

    it("never consults the store for a member the permission seam refuses", async () => {
        const { service, provider, reads } = await buildStored()

        await expect(service.read("", callOf(ACCOUNT_READ, '{"connectionId":"c-1"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.PermissionDenied,
        })
        await expect(service.read("member-1", callOf("openapi:crm.renewal.confirm", '{"connectionId":"c-1"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
        })

        expect(reads.get).not.toHaveBeenCalled()
        expect(provider.read).not.toHaveBeenCalled()
    })

    it("answers the live read when the store cannot be read or written (an answer too large included)", async () => {
        const { service, reads, intake, logger } = await buildStored()
        reads.get.mockRejectedValue(new Error("db_down"))
        intake.write.mockRejectedValue(new Error("VALUE_TOO_LARGE"))

        const answer = await service.read("member-1", callOf(ACCOUNT_READ, '{"connectionId":"c-1"}'))

        expect(answerOf(answer.data)).toMatchObject({ kind: "page", source: "live" })
        expect(logger.error).toHaveBeenCalledWith(
            WorkbenchDoorLogEvent.ProviderRead,
            expect.any(Error),
            expect.objectContaining({ outcome: "store_unreadable" }),
        )
        expect(logger.error).toHaveBeenCalledWith(
            WorkbenchDoorLogEvent.ProviderRead,
            expect.any(Error),
            expect.objectContaining({ outcome: "store_unwritable" }),
        )
    })
})

describe("provider-read-store.policy", () => {
    it("hashes the canonical arguments, so the member order never changes the key", () => {
        expect(interfaceCallOf("openapi:x", { b: 1, a: [{ d: 2, c: 3 }] })).toEqual(interfaceCallOf("openapi:x", { a: [{ c: 3, d: 2 }], b: 1 }))
        expect(interfaceCallOf("openapi:x", { a: 1 }).argsHash).not.toBe(interfaceCallOf("openapi:x", { a: 2 }).argsHash)
        expect(snapshotVerbOf({ provider: "sepay", read: "transactions" })).toBe("sepay:transactions")
        expect(snapshotKeyOf({ verb: "sepay:transactions", argsHash: "h" })).toBe("sepay:transactions:h")
    })
})

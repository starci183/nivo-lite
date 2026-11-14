import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { DoorProviderReadsService } from "./door-provider-reads.service"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import type {
    InterfaceProviderAnswer,
    InterfaceReadProvider,
    OptionalProviderInfo,
    ProviderRegistryReads,
} from "./provider-reads.contracts"
import type { DoorCall } from "./workbench-door.contracts"
import { INTERFACE_READ_PROVIDERS, PROVIDER_REGISTRY_READS_PORT } from "./workbench-door.decorators"
import { WorkbenchDoorLogEvent } from "./workbench-door.log-events"

const NOW = new Date("2026-11-12T04:00:00.000Z")
const PAGE: InterfaceProviderAnswer = { kind: "page", rows: [{ code: "ACME" }], cursor: null, truncated: false, omitted: 0 }

const callOf = (name: string, payload = "{}"): DoorCall => ({ workspaceId: "ws-1", name, payload, locale: "vi" })

const build = async (freshness?: "live" | "synced") => {
    const logger = mock<Logger>()
    const infoOf = jest.fn<Promise<OptionalProviderInfo>, [string, string]>(() =>
        Promise.resolve({ connectionId: "c-1", state: "ok", figures: [], asOf: "2026-11-12T03:00:00.000Z" }),
    )
    const provider = mock<InterfaceReadProvider>({ provider: "openapi", infoOf, ...(freshness === undefined ? {} : { freshness }) })
    provider.readsOf.mockResolvedValue([{ name: "nivo.api.crm.nivoweb.get.customers", shape: "page", input: { type: "object" }, output: null }])
    provider.read.mockResolvedValue(PAGE)
    const registry = mock<ProviderRegistryReads>()
    registry.configOf.mockResolvedValue({ connectionId: "c-1", triggers: [] })
    registry.rightsOf.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DoorProviderReadsService,
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: INTERFACE_READ_PROVIDERS, useValue: [provider] },
            { provide: PROVIDER_REGISTRY_READS_PORT, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(DoorProviderReadsService), provider, registry, logger }
}

const valueOf = (data: string): unknown => {
    const parsed = parseJsonText(data)
    return parsed.ok ? parsed.value : null
}

describe("DoorProviderReadsService freshness", () => {
    it("says a named read is live as of the call unless its provider says its reads come from its store", async () => {
        const live = await build()
        const synced = await build("synced")

        expect(valueOf((await live.service.read("member-1", callOf("openapi:nivo.api.crm.nivoweb.get.customers"))).data)).toMatchObject({
            kind: "page",
            source: "live",
            asOf: NOW.toISOString(),
        })
        expect(valueOf((await synced.service.read("member-1", callOf("openapi:nivo.api.crm.nivoweb.get.customers"))).data)).toMatchObject({
            source: "synced",
        })
    })

    it("says an account's info is synced, as of what the provider last stored", async () => {
        const { service } = await build()

        const answer = await service.read("member-1", callOf("openapi:info", '{"connectionId":"c-1"}'))

        expect(valueOf(answer.data)).toMatchObject({ kind: "info", source: "synced", asOf: "2026-11-12T03:00:00.000Z" })
    })
})

describe("DoorProviderReadsService registry reads", () => {
    it("answers the trigger configuration of one account of the proven workspace", async () => {
        const { service, registry, provider, logger } = await build()

        const answer = await service.read("member-1", callOf("sepay:config", '{"connectionId":"c-1"}'))

        expect(valueOf(answer.data)).toEqual({ kind: "config", connectionId: "c-1", triggers: [] })
        expect(registry.configOf).toHaveBeenCalledWith("ws-1", "sepay", "c-1")
        // A provider that registered no read of its own (here the door only knows `openapi`) still answers its registry reads.
        expect(provider.read).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(WorkbenchDoorLogEvent.ProviderRead, {
            workspaceId: "ws-1",
            memberId: "member-1",
            provider: "sepay",
            read: "config",
            outcome: "config",
            rows: 1,
        })
    })

    it("refuses config and rights without an account, and answers unknown for a provider or an account the workspace lacks", async () => {
        const { service } = await build()

        await expect(service.read("member-1", callOf("sepay:config"))).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.PayloadInvalid })
        await expect(service.read("member-1", callOf("sepay:rights", '{"connectionId":"c-9"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
        })
        await expect(service.read("member-1", callOf("sepay:docs"))).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.ReadUnknown })
    })

    it("answers a registry read named by its API verb exactly as by the old `<provider>:<read>`", async () => {
        const { service, registry } = await build()

        const byVerb = await service.read("member-1", callOf("nivo.api.zalo-oa.config", '{"connectionId":"c-1"}'))
        const byOld = await service.read("member-1", callOf("zalo_oa:config", '{"connectionId":"c-1"}'))

        expect(valueOf(byVerb.data)).toEqual(valueOf(byOld.data))
        expect(registry.configOf).toHaveBeenNthCalledWith(1, "ws-1", "zalo_oa", "c-1")
        expect(registry.configOf).toHaveBeenNthCalledWith(2, "ws-1", "zalo_oa", "c-1")
    })

    it("serves no registry read API does not name: NIVO's own pseudo-account, a provider of no catalogue", async () => {
        const { service, registry } = await build()

        await expect(service.read("member-1", callOf("nivo:config", '{"connectionId":"c-1"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
        })
        await expect(service.read("member-1", callOf("acme:rights", '{"connectionId":"c-1"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
        })
        expect(registry.configOf).not.toHaveBeenCalled()
        expect(registry.rightsOf).not.toHaveBeenCalled()
    })

    it("refuses a caller that is no member", async () => {
        const { service, registry } = await build()

        await expect(service.read("", callOf("sepay:config", '{"connectionId":"c-1"}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.PermissionDenied,
        })
        expect(registry.configOf).not.toHaveBeenCalled()
    })
})

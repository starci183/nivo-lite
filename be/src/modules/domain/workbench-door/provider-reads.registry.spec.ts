import { API, API_CARRIER, PROVIDER_API, apiSegmentOf } from "@nivo-lite/agent-sdk/names"
import { CORE_API_READS, apiVerbOfRead } from "./provider-reads.registry"
import { providerReadNameOf } from "./provider-reads.policy"

describe("provider-reads.registry CORE_API_READS", () => {
    it("holds one reader for every core API read and no other: the verb is the provider's segment and the read", () => {
        const verbs = Object.values(PROVIDER_API).flatMap((reads) => Object.values(reads))
        expect(Object.keys(CORE_API_READS).toSorted()).toEqual([...verbs].toSorted())
        const wrong = Object.entries(CORE_API_READS).filter(
            ([verb, entry]) => verb !== `nivo.api.${apiSegmentOf(entry.provider)}.${entry.read}`,
        )
        expect(wrong).toEqual([])
    })

    it("names each reader by the door's provider key: the core key of PROVIDER, or the carrier of the sources", () => {
        expect(CORE_API_READS[API.zaloOa.config]).toEqual({ provider: "zalo_oa", read: "config" })
        expect(CORE_API_READS[API.sepay.info]).toEqual({ provider: "sepay", read: "info" })
        expect(CORE_API_READS[API.openapi.info]).toEqual({ provider: API_CARRIER, read: "info" })
    })
})

describe("provider-reads.registry apiVerbOfRead", () => {
    it("gives the API verb of a core read of either spelling, and null for a read no core reader serves", () => {
        expect(apiVerbOfRead({ provider: "sepay", read: "info" })).toBe(API.sepay.info)
        expect(apiVerbOfRead({ provider: "zalo_oa", read: "rights" })).toBe(API.zaloOa.rights)
        expect(apiVerbOfRead({ provider: "telegram", read: "info" })).toBeNull()
        expect(apiVerbOfRead({ provider: "sepay", read: "transactions" })).toBeNull()
        expect(apiVerbOfRead({ provider: API_CARRIER, read: "nivo.api.crm.get.customers" })).toBeNull()
    })
})

describe("provider-reads.policy providerReadNameOf: both spellings of a provider read", () => {
    it("resolves an API verb of a core provider to the door's provider and read, the same as the old `<provider>:<read>`", () => {
        expect(providerReadNameOf(API.sepay.info)).toEqual(providerReadNameOf("sepay:info"))
        expect(providerReadNameOf(API.zaloOa.config)).toEqual({ provider: "zalo_oa", read: "config" })
        expect(providerReadNameOf("nivo.api.sepay.transactions")).toEqual({ provider: "sepay", read: "transactions" })
    })

    it("resolves a source's API verb to the carrier with the verb as its read, the same as the stored `openapi:<verb>` binding", () => {
        expect(providerReadNameOf("nivo.api.crm.get.customers")).toEqual({ provider: API_CARRIER, read: "nivo.api.crm.get.customers" })
        expect(providerReadNameOf("openapi:nivo.api.crm.get.customers")).toEqual(providerReadNameOf("nivo.api.crm.get.customers"))
    })

    it("names no provider read for a module read or a NIVO verb of another level", () => {
        expect(providerReadNameOf("sales.leads")).toBeNull()
        expect(providerReadNameOf("nivo.tool.invoice.create")).toBeNull()
        expect(providerReadNameOf("nivo.api.sepay")).toBeNull()
    })
})

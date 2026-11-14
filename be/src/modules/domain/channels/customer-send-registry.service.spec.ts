import { mock } from "@starci/jest-preset"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { CustomerSendPort } from "./customer-send-ports.contracts"
import { CustomerSendRegistryService } from "./customer-send-registry.service"

describe("CustomerSendRegistryService", () => {
    const live = mock<CustomerSendPort>({ provider: "zalo_oa" })
    const sandbox = mock<CustomerSendPort>({ provider: "zalo_oa" })
    const zalo = connectionRecord({ provider: "zalo_oa" })

    it("starts empty and answers undefined for a live account of a provider nobody registered", () => {
        const registry = new CustomerSendRegistryService()

        expect(registry.providers()).toEqual([])
        expect(registry.portFor(zalo)).toBeUndefined()
    })

    it("answers the live port to a live account and the sandbox port to a sandbox account, by the one switch", () => {
        const registry = new CustomerSendRegistryService()
        registry.register({ live, sandbox })

        expect(registry.providers()).toEqual(["zalo_oa"])
        expect(registry.portFor(zalo)).toBe(live)
        expect(registry.portFor({ ...zalo, sandbox: true })).toBe(sandbox)
    })

    it("refuses a sandbox account of a provider that registered no sandbox, never answering the live port", () => {
        const registry = new CustomerSendRegistryService()
        registry.register(live)

        const lookup = (): unknown => registry.portFor({ ...zalo, sandbox: true })
        expect(lookup).toThrow(Error)
        try {
            lookup()
        } catch (cause) {
            expect(cause).toMatchObject({ code: ProviderRegistryErrorCode.SandboxMissing })
        }
    })
})

import { Test } from "@nestjs/testing"
import { ProviderRegistryErrorCode, TemplateMessageRegistryService, proofOf } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { ZaloZnsProviderRegistrationService } from "./zalo-zns-provider-registration.service"
import { ZaloZnsTemplateService } from "./zalo-zns-template.service"

const account = connectionRecord({ id: "c", workspaceId: "w", provider: "zalo_oa", name: "OA", meta: {} })

describe("ZaloZnsTemplateService (docs-missing)", () => {
    it("refuses not_available, proved not_sent, and registers under the OA's provider key", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [ZaloZnsTemplateService, ZaloZnsProviderRegistrationService, TemplateMessageRegistryService] }).compile()
        const service = moduleRef.get(ZaloZnsTemplateService)
        const failure: unknown = await service.sendTemplate(account, { phone: "0900000000", templateId: "1", data: {}, trackingId: null }).catch((cause: unknown) => cause)

        expect(failure).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotAvailable, params: { provider: "zalo_oa" } })
        expect(proofOf(failure)).toBe("not_sent")

        const registry = moduleRef.get(TemplateMessageRegistryService)
        moduleRef.get(ZaloZnsProviderRegistrationService).onModuleInit()
        expect(registry.of("zalo_oa")).toBe(service)
    })
})

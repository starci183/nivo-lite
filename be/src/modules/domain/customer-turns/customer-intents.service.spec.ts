import { Test } from "@nestjs/testing"
import { IntentRegistryService } from "@modules/domain/intent-contracts"
import { CustomerIntentsService } from "./customer-intents.service"

describe("CustomerIntentsService", () => {
    it("registers the customer reply in the registry when the module starts", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [CustomerIntentsService, IntentRegistryService],
        }).compile()
        const registry = moduleRef.get(IntentRegistryService)

        moduleRef.get(CustomerIntentsService).onModuleInit()

        expect(registry.resultSchemaOf("customer_reply")).toBeDefined()
        expect(registry.checkOf("lead_complete")).toBeDefined()
        expect(registry.needsAnswer("customer_message")).toBe(true)
    })
})

import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentPluginsService } from "@modules/domain/agent-plugins"
import { CUSTOMER_PLUGIN } from "./customer-intents.policy"
import { CustomerIntentsService } from "./customer-intents.service"

describe("CustomerIntentsService", () => {
    it("registers the manifest of the customer reply when the module starts", async () => {
        const plugins = mock<AgentPluginsService>({ add: jest.fn() })
        const moduleRef = await Test.createTestingModule({
            providers: [CustomerIntentsService, { provide: AgentPluginsService, useValue: plugins }],
        }).compile()

        moduleRef.get(CustomerIntentsService).onModuleInit()

        expect(plugins.add).toHaveBeenCalledWith(CUSTOMER_PLUGIN)
        expect(CUSTOMER_PLUGIN.key).toBe("customer")
    })
})

import { Test } from "@nestjs/testing"
import { AutomationsErrorCode } from "@modules/domain/automations"
import { AutomationPortsService } from "./automation-ports.service"

const refusal = (port: string) => ({ code: AutomationsErrorCode.PortPending, params: { port } })

describe("AutomationPortsService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [AutomationPortsService] }).compile()
        return moduleRef.get(AutomationPortsService)
    }

    it("refuses the authority gate by name", async () => {
        const service = await build()
        await expect(service.submit()).rejects.toMatchObject(refusal("gate"))
    })

    it("refuses every Office call by name", async () => {
        const service = await build()
        await expect(service.postLine()).rejects.toMatchObject(refusal("office"))
        await expect(service.logEvidence()).rejects.toMatchObject(refusal("office"))
        await expect(service.openFollowUp()).rejects.toMatchObject(refusal("office"))
    })

    it("refuses every records call by name", async () => {
        const service = await build()
        await expect(service.createLead()).rejects.toMatchObject(refusal("records"))
        await expect(service.attachContractLead()).rejects.toMatchObject(refusal("records"))
    })

    it("refuses every mail call by name", async () => {
        const service = await build()
        await expect(service.sendOwnerEmail()).rejects.toMatchObject(refusal("mailer"))
        await expect(service.requestCustomerEmail()).rejects.toMatchObject(refusal("mailer"))
    })

    it("refuses the flow engine by name", async () => {
        const service = await build()
        await expect(service.run()).rejects.toMatchObject(refusal("flows"))
    })
})

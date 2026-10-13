import { AutomationsErrorCode } from "@modules/domain/automations"
import { AutomationPortsService } from "./automation-ports.service"

const refusal = (port: string) => ({ code: AutomationsErrorCode.PortPending, params: { port } })

describe("AutomationPortsService", () => {
    const service = new AutomationPortsService()

    it("refuses the authority gate by name", async () => {
        await expect(service.submit()).rejects.toMatchObject(refusal("gate"))
    })

    it("refuses every Office call by name", async () => {
        await expect(service.postLine()).rejects.toMatchObject(refusal("office"))
        await expect(service.logEvidence()).rejects.toMatchObject(refusal("office"))
        await expect(service.openFollowUp()).rejects.toMatchObject(refusal("office"))
    })

    it("refuses every records call by name", async () => {
        await expect(service.createLead()).rejects.toMatchObject(refusal("records"))
        await expect(service.attachContractLead()).rejects.toMatchObject(refusal("records"))
    })

    it("refuses every mail call by name", async () => {
        await expect(service.sendOwnerEmail()).rejects.toMatchObject(refusal("mailer"))
        await expect(service.requestCustomerEmail()).rejects.toMatchObject(refusal("mailer"))
    })

    it("refuses the flow engine by name", async () => {
        await expect(service.run()).rejects.toMatchObject(refusal("flows"))
    })
})

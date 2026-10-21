import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ContractsService } from "@modules/domain/contracts"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { AutomationRecordsService } from "./automation-records.service"

const setup = async () => {
    const leads = mock<LeadRecordsService>()
    leads.capture.mockResolvedValue(mock<LeadRecordRow>({ id: "lead-9" }))
    const contracts = mock<ContractsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationRecordsService,
            { provide: LeadRecordsService, useValue: leads },
            { provide: ContractsService, useValue: contracts },
        ],
    }).compile()
    return { subject: moduleRef.get(AutomationRecordsService), leads, contracts }
}

describe("AutomationRecordsService", () => {
    it("creates a live lead known by name only and moves it to the stage asked for", async () => {
        const { subject, leads } = await setup()

        await expect(
            subject.createLead("ws-1", { contactName: "An", channel: "Contract", need: "Renew", stage: "qualified" }),
        ).resolves.toBe("lead-9")
        expect(leads.capture).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            contactName: "An",
            company: "—",
            channel: "Contract",
            need: "Renew",
            phone: null,
            email: null,
        })
        expect(leads.classify).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-9",
            stage: "qualified",
            contextSummary: null,
        })
    })

    it("attaches the lead to the contract through the contracts capability", async () => {
        const { subject, contracts } = await setup()

        await subject.attachContractLead("ws-1", "c-1", "lead-9")

        expect(contracts.attachLead).toHaveBeenCalledWith("ws-1", "c-1", "lead-9")
    })
})

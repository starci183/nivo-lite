import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { BookingChatLookupService } from "@modules/domain/bookings"
import { LeadFlowStoreService } from "@modules/domain/lead-flows"
import { LeadRecordsService } from "@modules/domain/leads"
import { WorkItemsService } from "@modules/domain/work-items"
import { RecordInstallationService } from "./record-installation.service"

const RECORD_ID = "0b6c5d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e"

const build = async () => {
    const workItems = mock<WorkItemsService>()
    const conversations = mock<AgentConversationsService>()
    const bookings = mock<BookingChatLookupService>()
    const flows = mock<LeadFlowStoreService>()
    const leads = mock<LeadRecordsService>()
    for (const owner of [workItems, conversations, bookings, flows, leads]) {
        owner.installationIdOf.mockResolvedValue(null)
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            RecordInstallationService,
            { provide: WorkItemsService, useValue: workItems },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: BookingChatLookupService, useValue: bookings },
            { provide: LeadFlowStoreService, useValue: flows },
            { provide: LeadRecordsService, useValue: leads },
        ],
    }).compile()
    return { service: moduleRef.get(RecordInstallationService), workItems, conversations, bookings, flows, leads }
}

describe("RecordInstallationService", () => {
    it("answers no installation for an id that is not a record id, without asking anyone", async () => {
        const { service, workItems } = await build()

        await expect(service.installationOfRecord("ws-1", "not-a-uuid")).resolves.toEqual({ installationId: null })

        expect(workItems.installationIdOf).not.toHaveBeenCalled()
    })

    it("answers the installation of the first owner that names one", async () => {
        const { service, workItems, conversations, bookings, flows, leads } = await build()
        bookings.installationIdOf.mockResolvedValue("inst-booking")
        leads.installationIdOf.mockResolvedValue("inst-lead")

        await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({
            installationId: "inst-booking",
        })

        for (const owner of [workItems, conversations, bookings, flows, leads]) {
            expect(owner.installationIdOf).toHaveBeenCalledWith("ws-1", RECORD_ID)
        }
    })

    it("answers none when no owner names an installation", async () => {
        const { service } = await build()

        await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({ installationId: null })
    })
})

import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { BookingChatLookupService } from "@modules/domain/bookings"
import { LeadFlowStoreService } from "@modules/domain/lead-flows"
import { LeadRecordsService } from "@modules/domain/leads"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InstanceOfRecordService } from "./instance-of-record.service"

const RECORD_ID = "0b6c5d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e"

const build = async () => {
    const members = mock<WorkspaceMembersService>()
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
            InstanceOfRecordService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: WorkItemsService, useValue: workItems },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: BookingChatLookupService, useValue: bookings },
            { provide: LeadFlowStoreService, useValue: flows },
            { provide: LeadRecordsService, useValue: leads },
        ],
    }).compile()
    return {
        service: moduleRef.get(InstanceOfRecordService),
        members,
        owners: { workItems, conversations, bookings, flows, leads },
    }
}

describe("InstanceOfRecordService", () => {
    it("answers no installation for an id that is not a record id, without asking any owner", async () => {
        const { service, members, owners } = await build()

        await expect(service.installationOfRecord("u1", "ws-1", "not-a-uuid")).resolves.toEqual({
            installationId: null,
        })

        expect(members.require).toHaveBeenCalledWith("u1", "ws-1")
        expect(owners.workItems.installationIdOf).not.toHaveBeenCalled()
    })

    it.each(["workItems", "conversations", "bookings", "flows", "leads"] as const)(
        "answers the installation named by the %s owner",
        async (name) => {
            const { service, owners } = await build()
            owners[name].installationIdOf.mockResolvedValue("inst-1")

            await expect(service.installationOfRecord("u1", "ws-1", RECORD_ID)).resolves.toEqual({
                installationId: "inst-1",
            })

            for (const owner of Object.values(owners)) {
                expect(owner.installationIdOf).toHaveBeenCalledWith("ws-1", RECORD_ID)
            }
        },
    )

    it("answers the first owner that names one when several do", async () => {
        const { service, owners } = await build()
        owners.bookings.installationIdOf.mockResolvedValue("inst-booking")
        owners.leads.installationIdOf.mockResolvedValue("inst-lead")

        await expect(service.installationOfRecord("u1", "ws-1", RECORD_ID)).resolves.toEqual({
            installationId: "inst-booking",
        })
    })

    it("answers none when no owner names an installation", async () => {
        const { service } = await build()

        await expect(service.installationOfRecord("u1", "ws-1", RECORD_ID)).resolves.toEqual({ installationId: null })
    })

    it("propagates a refused membership without asking any owner", async () => {
        const { service, members, owners } = await build()
        members.require.mockRejectedValue(new Error("not a member"))

        await expect(service.installationOfRecord("u1", "ws-1", RECORD_ID)).rejects.toThrow("not a member")

        expect(owners.workItems.installationIdOf).not.toHaveBeenCalled()
    })
})

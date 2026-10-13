import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AutomationOfficeService } from "./automation-office.service"

const setup = async () => {
    const em = mockEntityManager({ query: [] })
    const messages = mock<MessagesService>()
    const events = mock<EventsService>()
    const journal = mock<ResponsibilityJournalService>()
    journal.openNamed.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationOfficeService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MessagesService, useValue: messages },
            { provide: EventsService, useValue: events },
            { provide: ResponsibilityJournalService, useValue: journal },
        ],
    }).compile()
    return { subject: moduleRef.get(AutomationOfficeService), em, messages, events, journal }
}

describe("AutomationOfficeService", () => {
    it("posts a NIVO line in the team chat about the lead", async () => {
        const { subject, em, messages } = await setup()

        await subject.postLine("ws-1", "An wrote after hours", "lead-1")

        expect(messages.postSystem).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            leadId: "lead-1",
            body: "An wrote after hours",
            manager: em,
        })
    })

    it("writes an evidence line with no lead and no proof as nulls", async () => {
        const { subject, events } = await setup()

        await subject.logEvidence("ws-1", { kind: "automation.auto_send", actor: "Nurture", summary: "Sent" })

        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "automation.auto_send",
            actor: "Nurture",
            summary: "Sent",
            leadId: null,
            evidence: null,
        })
    })

    it("opens a follow-up through the responsibilities journal and answers whether it opened one", async () => {
        const { subject, journal } = await setup()
        const task = {
            leadId: "lead-1",
            title: "Call An back",
            ownerName: "Binh",
            nextAction: "Call An tomorrow",
            dueAt: "2026-10-14T02:00:00.000Z",
        }

        await expect(subject.openFollowUp("ws-1", task)).resolves.toBe(true)
        expect(journal.openNamed).toHaveBeenCalledWith("ws-1", task)
    })
})

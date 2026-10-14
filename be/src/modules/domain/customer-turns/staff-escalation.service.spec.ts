import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { EventsService } from "@modules/domain/events"
import { OfficeLinesService } from "@modules/domain/messages"
import { StaffService } from "@modules/domain/staff"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { StaffEscalationService } from "./staff-escalation.service"

const WS = "11111111-1111-4111-8111-111111111111"
const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) => `${key}${JSON.stringify(params ?? {})}`,
})
const member = (id: string, name: string, role: string, active = true) => ({ id, name, role, active })
const escalation = { workItemId: "w1", leadId: "l1", customerName: "Lan", question: "Price?", proposed: "50k" }

const build = async (staffRows: ReadonlyArray<ReturnType<typeof member>>) => {
    const staff = mock<StaffService>({ list: jest.fn().mockResolvedValue(staffRows) })
    const items = mock<WorkItemsService>({ assign: jest.fn().mockResolvedValue(true) })
    const office = mock<OfficeLinesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            StaffEscalationService,
            { provide: StaffService, useValue: staff },
            { provide: WorkItemsService, useValue: items },
            { provide: OfficeLinesService, useValue: office },
            { provide: EventsService, useValue: events },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(StaffEscalationService), items, office, events, logger }
}

describe("StaffEscalationService", () => {
    it("assigns the advising colleague and tags them in the Office as the Chatbot", async () => {
        const { service, items, office } = await build([
            member("s1", "Chi Mai", "Ke toan"),
            member("s2", "Anh Minh", "Tu van vien"),
        ])
        await expect(service.escalate(WS, escalation, "vi")).resolves.toBe(true)
        expect(items.assign).toHaveBeenCalledWith(WS, "w1", "s2")
        expect(office.post).toHaveBeenCalledWith(
            { workspaceId: WS },
            expect.objectContaining({ dept: "chatbot", work_item_id: "w1", lead_id: "l1" }),
        )
        expect(String(office.post.mock.calls[0]?.[1]?.body)).toContain('"handle":"minh"')
    })

    it("assigns the oldest active colleague when nobody advises customers", async () => {
        const { service, items, events, office } = await build([
            member("s1", "Chi Mai", "Ke toan"),
            member("s2", "Anh Nam", "Bao ve", false),
        ])
        await expect(service.escalate(WS, { ...escalation, customerName: "  ", proposed: "   " }, "vi")).resolves.toBe(
            true,
        )
        expect(items.assign).toHaveBeenCalledWith(WS, "w1", "s1")
        expect(events.record).toHaveBeenCalledWith(
            expect.objectContaining({ summary: "→ Chi Mai", kind: "work.assigned" }),
        )
        expect(String(office.post.mock.calls[0]?.[1]?.body)).toContain("staffCustomerUnknown")
        expect(String(office.post.mock.calls[0]?.[1]?.body)).not.toContain("staffAskDraft")
    })

    it("keeps the item when the assignment does not stick", async () => {
        const { service, items, office } = await build([member("s1", "Mai", "Sales")])
        items.assign.mockResolvedValue(false)
        await expect(service.escalate(WS, { ...escalation, proposed: null }, "vi")).resolves.toBe(false)
        expect(office.post).not.toHaveBeenCalled()
    })

    it("adds the draft when the agent proposed one", async () => {
        const { service, office } = await build([member("s1", "Mai", "Sales")])
        await expect(service.escalate(WS, escalation, "vi")).resolves.toBe(true)
        expect(String(office.post.mock.calls[0]?.[1]?.body)).toContain("staffAskDraft")
        await service.escalate(WS, { ...escalation, proposed: null }, "vi")
        expect(String(office.post.mock.calls[1]?.[1]?.body)).not.toContain("staffAskDraft")
    })

    it("answers false and logs when the office cannot be reached", async () => {
        const { service, logger, office } = await build([member("s1", "Mai", "Sales")])
        const cause = new Error("office down")
        office.post.mockRejectedValue(cause)
        await expect(service.escalate(WS, escalation, "vi")).resolves.toBe(false)
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.EscalationFailed, cause, { workItemId: "w1" })
    })

    it("keeps the item for the owner when nobody is active", async () => {
        const { service, items } = await build([member("s1", "Mai", "Sales", false)])
        await expect(service.escalate(WS, escalation, "vi")).resolves.toBe(false)
        expect(items.assign).not.toHaveBeenCalled()
    })
})

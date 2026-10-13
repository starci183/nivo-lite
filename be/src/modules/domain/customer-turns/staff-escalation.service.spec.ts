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
import { StaffEscalationService } from "./staff-escalation.service"

const WS = "11111111-1111-4111-8111-111111111111"
const catalog: MessageCatalog = {
    get: (key: string, params?: Readonly<Record<string, string | number>>) => `${key}${JSON.stringify(params ?? {})}`,
}
const member = (id: string, name: string, role: string, active = true) => ({ id, name, role, active })
const escalation = { workItemId: "w1", leadId: "l1", customerName: "Lan", question: "Price?", proposed: "50k" }

const build = async (staffRows: ReadonlyArray<ReturnType<typeof member>>) => {
    const staff = { list: jest.fn().mockResolvedValue(staffRows) }
    const items = { assign: jest.fn().mockResolvedValue(true) }
    const office = { post: jest.fn().mockResolvedValue(undefined) }
    const events = { record: jest.fn().mockResolvedValue(undefined) }
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const moduleRef = await Test.createTestingModule({
        providers: [
            StaffEscalationService,
            { provide: StaffService, useValue: mock<StaffService>(staff) },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>(items) },
            { provide: OfficeLinesService, useValue: mock<OfficeLinesService>(office) },
            { provide: EventsService, useValue: mock<EventsService>(events) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>(catalog) },
            { provide: LOGGER, useValue: mock<Logger>(logger) },
        ],
    }).compile()
    return { service: moduleRef.get(StaffEscalationService), items, office }
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

    it("keeps the item for the owner when nobody is active", async () => {
        const { service, items } = await build([member("s1", "Mai", "Sales", false)])
        await expect(service.escalate(WS, escalation, "vi")).resolves.toBe(false)
        expect(items.assign).not.toHaveBeenCalled()
    })
})

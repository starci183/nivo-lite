import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeLinesService } from "@modules/domain/messages"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { MarketingCardsService } from "./marketing-cards.service"
import type { CardScope } from "./marketing-cards.service"
import type { MarketingWeeklyReport } from "./content-agent.contracts"

const build = async () => {
    const lines = mock<OfficeLinesService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation(
        (key: string, params?: Readonly<Record<string, unknown>>) => `${key} ${JSON.stringify(params ?? {})}`,
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingCardsService,
            { provide: OfficeLinesService, useValue: lines },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(MarketingCardsService), lines }
}

const SCOPE: CardScope = { workspaceId: "ws-1", locale: "vi" }
const REPORT: MarketingWeeklyReport = {
    weekStart: "2026-10-12",
    weekEnd: "2026-10-18",
    reach: { value: 12480, previous: 10000, changePct: 25 },
    engagements: { value: 1286, previous: 900, changePct: 43 },
    messages: { value: 48, previous: 36, changePct: 33 },
    days: [],
    channels: ["facebook"],
}

describe("MarketingCardsService", () => {
    it("posts a draft card as a line of the content agent tied to its work item", async () => {
        const { service, lines } = await build()

        const body = await service.emit(SCOPE, {
            kind: "draft_post",
            workItemId: "w-1",
            contentItemId: "c-1",
            title: "Cuoi tuan",
            caption: "c",
            hashtags: [],
            images: [],
            script: [],
            channels: ["facebook"],
            sources: [],
        })

        expect(body).toBe('marketing.draftCard {"title":"Cuoi tuan"}')
        expect(lines.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1" },
            { body, lead_id: null, work_item_id: "w-1", dept: "content" },
        )
    })

    it("words the approval, schedule and report cards", async () => {
        const { service } = await build()

        expect(
            service.textOf("vi", {
                kind: "approval_request",
                workItemId: "w-2",
                contentItemId: "c-1",
                title: "T",
                channels: ["facebook", "zalo"],
                scheduledAt: "2026-10-21T02:00:00.000Z",
            }),
        ).toBe('marketing.approvalCard {"title":"T","channels":"facebook, zalo"}')
        expect(
            service.textOf("en", {
                kind: "schedule_confirmed",
                workItemId: "w-2",
                contentItemId: "c-1",
                title: "T",
                scheduledAt: "2026-10-21T02:00:00.000Z",
                channels: [{ channel: "facebook", ref: "p_1" }],
                failed: [],
            }),
        ).toBe('marketing.scheduledCard {"title":"T","at":"2026-10-21T02:00:00.000Z","channels":"facebook"}')
        expect(service.textOf("vi", { kind: "weekly_report", workItemId: null, report: REPORT })).toBe(
            'marketing.reportCard {"from":"2026-10-12","to":"2026-10-18","reach":"12480","engagements":"1286","messages":"48"}',
        )
    })

    it("posts a plain line", async () => {
        const { service, lines } = await build()

        await service.line(SCOPE, "oops", null)

        expect(lines.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1" },
            { body: "oops", lead_id: null, work_item_id: null, dept: "content" },
        )
    })
})

import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { MarketingCardsService } from "./marketing-cards.service"
import type { CardScope } from "./marketing-cards.service"
import type { MarketingWeeklyReport } from "./content-agent.contracts"
import type { DraftPostCard, ScheduleConfirmedCard, WeeklyReportCard } from "./marketing-cards.contracts"

const build = async () => {
    const chat = mock<TeamChatRoomsService>({
        postAsAgent: jest.fn(() => Promise.resolve({ roomId: "r-1", messageId: "m-1", agentId: "a-1" })),
    })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params, locale) =>
        Object.keys(params).length === 0 ? `${locale}:${key}` : `${locale}:${key} ${JSON.stringify(params)}`,
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            MarketingCardsService,
            { provide: TeamChatRoomsService, useValue: chat },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(MarketingCardsService), chat }
}

const SCOPE: CardScope = { workspaceId: "ws-1", locale: "vi" }

const REPORT: MarketingWeeklyReport = {
    weekStart: "2026-10-12",
    weekEnd: "2026-10-18",
    reach: { value: 12480, previous: 10000, changePct: 25 },
    engagements: { value: 1286, previous: 1400, changePct: -8 },
    messages: { value: 48, previous: 0, changePct: null },
    days: [],
    channels: ["facebook"],
    posts: [],
    postCount: 8,
    suggestion: null,
}

const DRAFT: DraftPostCard = {
    kind: "draft_post",
    workItemId: "w-1",
    contentItemId: "c-1",
    title: "Weekend",
    caption: "c",
    hashtags: ["#spa"],
    images: [],
    script: [],
    channels: ["facebook", "zalo"],
    sources: [],
}

const APPROVAL = {
    kind: "approval_request" as const,
    workItemId: "w-2",
    contentItemId: "c-1",
    title: "T",
    channels: ["facebook", "zalo"],
    scheduledAt: "2026-10-21T02:00:00.000Z",
}

const SCHEDULED: ScheduleConfirmedCard = {
    kind: "schedule_confirmed",
    workItemId: "w-3",
    contentItemId: "c-1",
    title: "S",
    scheduledAt: "2026-10-21T02:00:00.000Z",
    channels: [
        { channel: "facebook", ref: "p-1" },
        { channel: "zalo", ref: "p-2" },
    ],
    failed: [],
}

const REPORT_CARD: WeeklyReportCard = { kind: "weekly_report", workItemId: null, report: REPORT }

describe("MarketingCardsService textOf", () => {
    it("words each card kind in the language asked for", async () => {
        const { service } = await build()

        expect(service.textOf("vi", DRAFT)).toBe('vi:marketing.draftCard {"title":"Weekend"}')
        expect(service.textOf("vi", APPROVAL)).toBe(
            'vi:marketing.approvalCard {"title":"T","channels":"facebook, zalo"}',
        )
        expect(service.textOf("en", SCHEDULED)).toBe(
            'en:marketing.scheduledCard {"title":"S","at":"2026-10-21T02:00:00.000Z","channels":"facebook, zalo"}',
        )
        expect(service.textOf("vi", REPORT_CARD)).toBe(
            'vi:marketing.reportCard {"from":"2026-10-12","to":"2026-10-18","reach":"12480","engagements":"1286","messages":"48"}',
        )
    })
})

describe("MarketingCardsService emit and line", () => {
    it("says the text of a card to the owner as the content agent, once per work item, and answers the text", async () => {
        const { service, chat } = await build()

        await expect(service.emit(SCOPE, DRAFT)).resolves.toBe('vi:marketing.draftCard {"title":"Weekend"}')

        expect(chat.postAsAgent).toHaveBeenCalledWith("ws-1", {
            agent: "content",
            toUserId: null,
            body: 'vi:marketing.draftCard {"title":"Weekend"}',
            key: 'w-1:vi:marketing.draftCard {"title":"Weekend"}',
        })
    })

    it("keeps a card of no work item without a key, and cuts a long key", async () => {
        const { service, chat } = await build()

        await service.emit(SCOPE, REPORT_CARD)
        await service.line(SCOPE, "x".repeat(400), "w-9")

        const [first, second] = chat.postAsAgent.mock.calls
        expect(first?.[1].key).toBeNull()
        expect(second?.[1].key).toHaveLength(160)
    })

    it("says a plain line to the owner and does nothing when the workspace has no content agent", async () => {
        const { service, chat } = await build()
        chat.postAsAgent.mockResolvedValue(null)

        await expect(service.line(SCOPE, "oops", null)).resolves.toBeUndefined()

        expect(chat.postAsAgent).toHaveBeenCalledWith("ws-1", {
            agent: "content",
            toUserId: null,
            body: "oops",
            key: null,
        })
    })
})

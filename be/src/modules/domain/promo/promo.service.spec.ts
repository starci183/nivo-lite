import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PromoService } from "./promo.service"
import { FOUNDING_OFFER, INVOICE_TITLE_PREFIX } from "./promo.templates"
import { FIND_FOUNDING_MEMBER, FIND_LEAD_WAIT, FIND_PROMO_CHATBOT, FIND_PROMO_STATE } from "./persistence/promo.sql"

const INSIDE = "2026-10-12T03:00:00.000Z"
const OUTSIDE = "2026-11-01T00:00:00.000Z"

const build = async (em: MockEntityManager, at = INSIDE) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PromoService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CLOCK, useValue: new FakeClock(at) },
        ],
    }).compile()
    return { promo: moduleRef.get(PromoService), members }
}

describe("PromoService", () => {
    it("answers no chatbot when the workspace has none", async () => {
        const em = mockEntityManager({ query: [FIND_PROMO_CHATBOT, []] })
        const { promo } = await build(em)

        await expect(promo.chatbot("user-1", "ws-1")).resolves.toEqual({
            hasChatbot: false,
            agentId: null,
            handle: null,
            name: null,
        })
    })

    it("answers the earliest chatbot", async () => {
        const em = mockEntityManager({
            query: [FIND_PROMO_CHATBOT, [{ id: "bot-1", handle: "tea", name: "Tea bot" }]],
        })
        const { promo } = await build(em)

        await expect(promo.chatbot("user-1", "ws-1")).resolves.toEqual({
            hasChatbot: true,
            agentId: "bot-1",
            handle: "tea",
            name: "Tea bot",
        })
    })

    it("hides founding membership outside the offer window", async () => {
        const em = mockEntityManager()
        const { promo } = await build(em, OUTSIDE)

        await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(false)

        expect(em.query).not.toHaveBeenCalled()
    })

    it("reads founding membership inside the offer window", async () => {
        const em = mockEntityManager({ query: [FIND_FOUNDING_MEMBER, [{ is_founding_member: true }]] })
        const { promo } = await build(em)

        await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(true)

        expect(em.query).toHaveBeenCalledWith(FIND_FOUNDING_MEMBER, [
            "ws-1",
            FOUNDING_OFFER.startsAt,
            FOUNDING_OFFER.endsAt,
        ])
    })

    it("maps recorded promo facts onto the onboarding steps", async () => {
        const em = mockEntityManager({
            query: [
                [
                    FIND_PROMO_STATE,
                    [
                        {
                            chatbot_id: "bot-1",
                            has_knowledge: true,
                            is_founding_member: true,
                            website_count: 4,
                            after_hours_count: 1,
                            avg_wait_hours: 2,
                            has_customer_conversation: true,
                            has_lead_conversation: false,
                            has_approved: true,
                            has_won: false,
                            invoice_approved: true,
                        },
                    ],
                ],
            ],
        })
        const { promo } = await build(em)

        await expect(promo.state("user-1", "ws-1")).resolves.toEqual({
            hasChatbot: true,
            chatbotAgentId: "bot-1",
            isFoundingMember: true,
            websiteLeadStats: { count: 4, afterHoursCount: 1, avgWaitHours: 2 },
            onboarding: [
                { key: "Buy", done: true, href: "/modules/new?module=chatbot" },
                { key: "Knowledge", done: true, href: "/modules/bot-1" },
                { key: "Test", done: true, href: "/modules/bot-1/chat" },
                { key: "Lead", done: false, href: "/modules/bot-1/chat" },
                { key: "Approve", done: true, href: "/chat" },
                { key: "Won", done: false, href: "/leads" },
                { key: "Invoice", done: true, href: "/responsibilities" },
            ],
        })

        expect(em.query).toHaveBeenCalledWith(FIND_PROMO_STATE, [
            "ws-1",
            FOUNDING_OFFER.startsAt,
            FOUNDING_OFFER.endsAt,
            INVOICE_TITLE_PREFIX,
        ])
    })

    it("hides the wait note when the lead row is missing", async () => {
        const em = mockEntityManager({ query: [FIND_LEAD_WAIT, []] })
        const { promo } = await build(em)

        await expect(promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual({
            show: false,
            hours: null,
            replied: false,
        })

        expect(em.query).toHaveBeenCalledWith(FIND_LEAD_WAIT, ["ws-1", "lead-1", INSIDE])
    })
})

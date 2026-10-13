import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { PromoStateRow } from "./persistence/promo.rows"
import { FIND_FOUNDING_MEMBER, FIND_LEAD_WAIT, FIND_PROMO_CHATBOT, FIND_PROMO_STATE } from "./persistence/promo.sql"
import { PromoService } from "./promo.service"
import { FOUNDING_OFFER, INVOICE_TITLE_PREFIX } from "./promo.templates"

const IN_OFFER = "2026-10-13T02:00:00.000Z"

const build = async (entityManager: MockEntityManager, at: string = IN_OFFER) => {
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PromoService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CLOCK, useValue: new FakeClock(at) },
        ],
    }).compile()
    return { promo: moduleRef.get(PromoService), members }
}

const stateRow: PromoStateRow = {
    chatbot_id: "agent-1",
    has_knowledge: true,
    is_founding_member: true,
    website_count: 12,
    after_hours_count: 5,
    avg_wait_hours: 3.5,
    has_customer_conversation: true,
    has_lead_conversation: false,
    has_approved: true,
    has_won: false,
    invoice_approved: false,
}

describe("PromoService", () => {
    describe("chatbot", () => {
        it("answers the earliest chatbot of the workspace", async () => {
            const em = mockEntityManager({
                query: [FIND_PROMO_CHATBOT, [{ id: "agent-1", handle: "shop", name: "Shop bot" }]],
            })
            const { promo, members } = await build(em)

            await expect(promo.chatbot("user-1", "ws-1")).resolves.toEqual({
                hasChatbot: true,
                agentId: "agent-1",
                handle: "shop",
                name: "Shop bot",
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(em.query).toHaveBeenCalledWith(FIND_PROMO_CHATBOT, ["ws-1"])
        })

        it("answers no chatbot for a workspace without one", async () => {
            const { promo } = await build(mockEntityManager({ query: [FIND_PROMO_CHATBOT, []] }))

            await expect(promo.chatbot("user-1", "ws-1")).resolves.toEqual({
                hasChatbot: false,
                agentId: null,
                handle: null,
                name: null,
            })
        })
    })

    describe("foundingMember", () => {
        it("reads the purchase inside the live offer window", async () => {
            const em = mockEntityManager({ query: [FIND_FOUNDING_MEMBER, [{ is_founding_member: true }]] })
            const { promo } = await build(em)

            await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(true)
            expect(em.query).toHaveBeenCalledWith(FIND_FOUNDING_MEMBER, [
                "ws-1",
                FOUNDING_OFFER.startsAt,
                FOUNDING_OFFER.endsAt,
            ])
        })

        it("answers false when no purchase row comes back", async () => {
            const { promo } = await build(mockEntityManager({ query: [FIND_FOUNDING_MEMBER, []] }))

            await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(false)
        })

        it.each(["2026-09-28T12:00:00.000Z", "2026-11-01T00:00:00.000Z"])(
            "answers false without reading at %s, outside the offer",
            async (at) => {
                const em = mockEntityManager()
                const { promo, members } = await build(em, at)

                await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(false)
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(em.query).not.toHaveBeenCalled()
            },
        )
    })

    describe("state", () => {
        it("turns the recorded facts into stats and onboarding steps that link to the chatbot", async () => {
            const em = mockEntityManager({ query: [FIND_PROMO_STATE, [stateRow]] })
            const { promo } = await build(em)

            await expect(promo.state("user-1", "ws-1")).resolves.toEqual({
                hasChatbot: true,
                chatbotAgentId: "agent-1",
                isFoundingMember: true,
                websiteLeadStats: { count: 12, afterHoursCount: 5, avgWaitHours: 3.5 },
                onboarding: [
                    { key: "Buy", done: true, href: "/modules/new?module=chatbot" },
                    { key: "Knowledge", done: true, href: "/modules/agent-1" },
                    { key: "Test", done: true, href: "/modules/agent-1/chat" },
                    { key: "Lead", done: false, href: "/modules/agent-1/chat" },
                    { key: "Approve", done: true, href: "/chat" },
                    { key: "Won", done: false, href: "/leads" },
                    { key: "Invoice", done: false, href: "/responsibilities" },
                ],
            })
            expect(em.query).toHaveBeenCalledWith(FIND_PROMO_STATE, [
                "ws-1",
                FOUNDING_OFFER.startsAt,
                FOUNDING_OFFER.endsAt,
                INVOICE_TITLE_PREFIX,
            ])
        })

        it("points every chatbot step at the install page when nothing is recorded", async () => {
            const { promo } = await build(mockEntityManager({ query: [FIND_PROMO_STATE, []] }))

            await expect(promo.state("user-1", "ws-1")).resolves.toEqual({
                hasChatbot: false,
                chatbotAgentId: null,
                isFoundingMember: false,
                websiteLeadStats: { count: 0, afterHoursCount: 0, avgWaitHours: null },
                onboarding: [
                    { key: "Buy", done: false, href: "/modules/new?module=chatbot" },
                    { key: "Knowledge", done: false, href: "/modules/new?module=chatbot" },
                    { key: "Test", done: false, href: "/modules/new?module=chatbot" },
                    { key: "Lead", done: false, href: "/modules/new?module=chatbot" },
                    { key: "Approve", done: false, href: "/chat" },
                    { key: "Won", done: false, href: "/leads" },
                    { key: "Invoice", done: false, href: "/responsibilities" },
                ],
            })
        })
    })

    describe("leadWait", () => {
        it("answers the wait of the lead at the clock instant", async () => {
            const wait = { show: true, hours: 4, replied: false }
            const em = mockEntityManager({ query: [FIND_LEAD_WAIT, [wait]] })
            const { promo } = await build(em)

            await expect(promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual(wait)
            expect(em.query).toHaveBeenCalledWith(FIND_LEAD_WAIT, ["ws-1", "lead-1", IN_OFFER])
        })

        it("hides the note for a missing lead", async () => {
            const { promo } = await build(mockEntityManager({ query: [FIND_LEAD_WAIT, []] }))

            await expect(promo.leadWait("user-1", "ws-1", "missing")).resolves.toEqual({
                show: false,
                hours: null,
                replied: false,
            })
        })
    })
})

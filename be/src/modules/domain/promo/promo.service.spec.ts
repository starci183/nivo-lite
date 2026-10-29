import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { subQueryBuilder } from "@tests/fixtures/builders/sub-query-builder.builder"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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

/** Narrows the sub query a join was handed to the function that builds it. */
const isJoinSource = (value: unknown): value is (sub: unknown) => unknown => typeof value === "function"

const stateRow = {
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
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawOne: { id: "agent-1", handle: "shop", name: "Shop bot" } })
            answerQueryBuilders(em, read)
            const { promo, members } = await build(em)

            await expect(promo.chatbot("user-1", "ws-1")).resolves.toEqual({
                hasChatbot: true,
                agentId: "agent-1",
                handle: "shop",
                name: "Shop bot",
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(read.argsOf("from")).toEqual([["public.agents", "a"]])
            expect(read.argsOf("where")).toEqual([
                ["a.workspace_id = :workspaceId AND a.module = 'chatbot'", { workspaceId: "ws-1" }],
            ])
            expect(read.argsOf("orderBy")).toEqual([["a.created_at"]])
            expect(read.argsOf("addOrderBy")).toEqual([["a.id"]])
            expect(read.argsOf("limit")).toEqual([[1]])
        })

        it("answers no chatbot for a workspace without one", async () => {
            const em = mockEntityManager()
            answerQueryBuilders(em, fakeQueryBuilder({ getRawOne: undefined }))
            const { promo } = await build(em)

            await expect(promo.chatbot("user-1", "ws-1")).resolves.toEqual({
                hasChatbot: false,
                agentId: null,
                handle: null,
                name: null,
            })
        })
    })
})

describe("PromoService foundingMember", () => {
    describe("foundingMember", () => {
        it("reads the purchase inside the live offer window", async () => {
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getExists: true })
            answerQueryBuilders(em, read)
            const { promo } = await build(em)

            await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(true)
            expect(read.argsOf("from")).toEqual([["public.events", "e"]])
            expect(read.argsOf("where")).toEqual([
                ["e.workspace_id = :workspaceId AND e.kind = 'module.purchased'", { workspaceId: "ws-1" }],
            ])
            expect(read.argsOf("andWhere")).toEqual([
                [
                    "e.created_at >= :startsAt::timestamptz AND e.created_at <= :endsAt::timestamptz",
                    { startsAt: FOUNDING_OFFER.startsAt, endsAt: FOUNDING_OFFER.endsAt },
                ],
            ])
        })

        it("answers false when no purchase row comes back", async () => {
            const em = mockEntityManager()
            answerQueryBuilders(em, fakeQueryBuilder({ getExists: false }))
            const { promo } = await build(em)

            await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(false)
        })

        it.each(["2026-09-28T12:00:00.000Z", "2026-11-01T00:00:00.000Z"])(
            "answers false without reading at %s, outside the offer",
            async (at) => {
                const em = mockEntityManager()
                const { promo, members } = await build(em, at)

                await expect(promo.foundingMember("user-1", "ws-1")).resolves.toBe(false)
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(em.createQueryBuilder).not.toHaveBeenCalled()
            },
        )
    })
})

describe("PromoService state", () => {
    describe("state", () => {
        it("turns the recorded facts into stats and onboarding steps that link to the chatbot", async () => {
            const em = mockEntityManager()
            const read = subQueryBuilder({ getRawOne: stateRow })
            answerQueryBuilders(em, read)
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
            expect(read.argsOf("from")).toContainEqual(["public.workspaces", "ws"])
            expect(read.argsOf("where")).toContainEqual(["ws.id = :workspaceId", { workspaceId: "ws-1" }])
            expect(read.argsOf("setParameters")).toEqual([
                [
                    {
                        website: "%website%",
                        startsAt: FOUNDING_OFFER.startsAt,
                        endsAt: FOUNDING_OFFER.endsAt,
                        invoiceTitle: INVOICE_TITLE_PREFIX,
                    },
                ],
            ])
            const [joinSource] = read.argsOf("innerJoin")[0] ?? []
            expect(isJoinSource(joinSource) ? joinSource(read.builder) : null).toBe(read.builder)
            expect(read.argsOf("from")).toContainEqual(["public.events", "e"])
            expect(read.argsOf("groupBy")).toEqual([["e.lead_id"]])
            expect(read.argsOf("addSelect").map((call) => call[1])).toEqual(
                expect.arrayContaining([
                    "has_knowledge",
                    "is_founding_member",
                    "website_count",
                    "after_hours_count",
                    "avg_wait_hours",
                    "has_customer_conversation",
                    "has_lead_conversation",
                    "has_approved",
                    "has_won",
                    "invoice_approved",
                ]),
            )
        })

        it("points every chatbot step at the install page when nothing is recorded", async () => {
            const em = mockEntityManager()
            answerQueryBuilders(em, subQueryBuilder({ getRawOne: undefined }))
            const { promo } = await build(em)

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
})

describe("PromoService leadWait", () => {
    describe("leadWait", () => {
        it("answers the wait of the lead at the clock instant", async () => {
            const wait = { show: true, hours: 4, replied: false }
            const em = mockEntityManager()
            const read = subQueryBuilder({ getRawOne: wait })
            answerQueryBuilders(em, read)
            const { promo } = await build(em)

            await expect(promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual(wait)
            expect(read.argsOf("from")).toContainEqual(["public.leads", "l"])
            expect(read.argsOf("where")).toContainEqual([
                "l.workspace_id = :workspaceId AND l.id = :leadId",
                { workspaceId: "ws-1", leadId: "lead-1" },
            ])
            expect(read.argsOf("setParameters")).toEqual([[{ website: "%website%", now: new Date(IN_OFFER) }]])
            expect(read.argsOf("limit")).toContainEqual([1])
        })

        it("hides the note for a missing lead", async () => {
            const em = mockEntityManager()
            answerQueryBuilders(em, subQueryBuilder({ getRawOne: undefined }))
            const { promo } = await build(em)

            await expect(promo.leadWait("user-1", "ws-1", "missing")).resolves.toEqual({
                show: false,
                hours: null,
                replied: false,
            })
        })
    })
})

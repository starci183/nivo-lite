import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentSheet } from "@modules/domain/agents"
import { EventsReadService } from "@modules/domain/events"
import { ExecutionsFiguresService } from "@modules/domain/executions"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadView } from "@modules/domain/leads"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PromoService } from "./promo.service"
import { FOUNDING_OFFER, INVOICE_TITLE_PREFIX } from "./promo.templates"

const IN_OFFER = "2026-10-13T02:00:00.000Z"

const BOT: AgentSheet = {
    id: "agent-1",
    module: "chatbot",
    name: "Shop bot",
    handle: "shop",
    role: "Front desk",
    instructions: "",
    knowledge: "Open 9-5",
    greeting: "",
    approvalRule: "",
    status: "active",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
}

const LEAD: LeadView = {
    id: "lead-1",
    contact_name: "An",
    company: "",
    channel: "Website chat",
    need: "",
    stage: "new",
    context_summary: null,
    installation_id: null,
    created_at: "2026-10-13T00:00:00.000000+00:00",
}

const build = async (at: string = IN_OFFER) => {
    const members = mock<WorkspaceMembersService>()
    const agents = mock<AgentDirectoryService>()
    const events = mock<EventsReadService>()
    const leads = mock<LeadReadService>()
    const conversations = mock<AgentConversationsReadService>()
    const executions = mock<ExecutionsFiguresService>()
    const responsibilities = mock<ResponsibilityReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PromoService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CLOCK, useValue: new FakeClock(at) },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: EventsReadService, useValue: events },
            { provide: LeadReadService, useValue: leads },
            { provide: AgentConversationsReadService, useValue: conversations },
            { provide: ExecutionsFiguresService, useValue: executions },
            { provide: ResponsibilityReadService, useValue: responsibilities },
        ],
    }).compile()
    return {
        promo: moduleRef.get(PromoService),
        members,
        agents,
        events,
        leads,
        conversations,
        executions,
        responsibilities,
    }
}

type World = Awaited<ReturnType<typeof build>>

/** Every owner answers "nothing recorded". */
const empty = (world: World) => {
    world.agents.earliestSheetOfModule.mockResolvedValue(null)
    world.events.existsOfKindBetween.mockResolvedValue(false)
    world.events.firstAtByLead.mockResolvedValue([])
    world.events.existsOfKindForLeads.mockResolvedValue(false)
    world.events.firstAtOfKind.mockResolvedValue(null)
    world.leads.websiteOf.mockResolvedValue([])
    world.leads.idsAtStage.mockResolvedValue([])
    world.conversations.hasCustomerChat.mockResolvedValue(false)
    world.conversations.hasLeadChat.mockResolvedValue(false)
    world.executions.countApproved.mockResolvedValue(0)
    world.executions.hasApprovedAmong.mockResolvedValue(false)
    world.responsibilities.idsTitledLike.mockResolvedValue([])
}

describe("PromoService", () => {
    describe("chatbot", () => {
        it("answers the earliest chatbot of the workspace", async () => {
            const world = await build()
            world.agents.earliestSheetOfModule.mockResolvedValue(BOT)

            await expect(world.promo.chatbot("user-1", "ws-1")).resolves.toEqual({
                hasChatbot: true,
                agentId: "agent-1",
                handle: "shop",
                name: "Shop bot",
            })
            expect(world.members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(world.agents.earliestSheetOfModule).toHaveBeenCalledWith("ws-1", "chatbot")
        })

        it("answers no chatbot for a workspace without one", async () => {
            const world = await build()
            empty(world)

            await expect(world.promo.chatbot("user-1", "ws-1")).resolves.toEqual({
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
            const world = await build()
            world.events.existsOfKindBetween.mockResolvedValue(true)

            await expect(world.promo.foundingMember("user-1", "ws-1")).resolves.toBe(true)
            expect(world.events.existsOfKindBetween).toHaveBeenCalledWith(
                "ws-1",
                "module.purchased",
                new Date(FOUNDING_OFFER.startsAt),
                new Date(FOUNDING_OFFER.endsAt),
            )
        })

        it("answers false when no purchase row comes back", async () => {
            const world = await build()
            world.events.existsOfKindBetween.mockResolvedValue(false)

            await expect(world.promo.foundingMember("user-1", "ws-1")).resolves.toBe(false)
        })

        it.each(["2026-09-28T12:00:00.000Z", "2026-11-01T00:00:00.000Z"])(
            "answers false without reading at %s, outside the offer",
            async (at) => {
                const world = await build(at)

                await expect(world.promo.foundingMember("user-1", "ws-1")).resolves.toBe(false)
                expect(world.members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(world.events.existsOfKindBetween).not.toHaveBeenCalled()
            },
        )
    })
})

describe("PromoService state", () => {
    it("turns the recorded facts into stats and onboarding steps that link to the chatbot", async () => {
        const world = await build()
        empty(world)
        world.agents.earliestSheetOfModule.mockResolvedValue(BOT)
        world.events.existsOfKindBetween.mockResolvedValue(true)
        world.leads.websiteOf.mockResolvedValue([
            // 20:00 UTC = 03:00 Bangkok, after hours; answered after 2 hours
            { id: "w1", createdAt: new Date("2026-10-12T20:00:00.000Z") },
            // 03:00 UTC = 10:00 Bangkok, inside hours; answered after 4 hours
            { id: "w2", createdAt: new Date("2026-10-13T03:00:00.000Z") },
            // 11:00 UTC = 18:00 Bangkok, after hours; never answered
            { id: "w3", createdAt: new Date("2026-10-13T11:00:00.000Z") },
            // answered before it was created: no wait
            { id: "w4", createdAt: new Date("2026-10-13T05:00:00.000Z") },
        ])
        world.events.firstAtByLead.mockResolvedValue([
            { leadId: "w1", at: new Date("2026-10-12T22:00:00.000Z") },
            { leadId: "w2", at: new Date("2026-10-13T07:00:00.000Z") },
            { leadId: "w4", at: new Date("2026-10-13T04:00:00.000Z") },
        ])
        world.conversations.hasCustomerChat.mockResolvedValue(true)
        world.executions.countApproved.mockResolvedValue(3)

        await expect(world.promo.state("user-1", "ws-1")).resolves.toEqual({
            hasChatbot: true,
            chatbotAgentId: "agent-1",
            isFoundingMember: true,
            websiteLeadStats: { count: 4, afterHoursCount: 2, avgWaitHours: 3 },
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
        expect(world.members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(world.events.firstAtByLead).toHaveBeenCalledWith(
            "ws-1",
            ["execution.approved", "responsibility.assigned"],
            ["w1", "w2", "w3", "w4"],
        )
    })

    it("marks a win and an approved invoice step when the owners say so", async () => {
        const world = await build()
        empty(world)
        world.agents.earliestSheetOfModule.mockResolvedValue({ ...BOT, knowledge: "   " })
        world.leads.idsAtStage.mockResolvedValue(["won-1"])
        world.events.existsOfKindForLeads.mockResolvedValue(true)
        world.conversations.hasLeadChat.mockResolvedValue(true)
        world.responsibilities.idsTitledLike.mockResolvedValue(["r-1"])
        world.executions.hasApprovedAmong.mockResolvedValue(true)

        const state = await world.promo.state("user-1", "ws-1")

        expect(state.onboarding.map((step) => [step.key, step.done])).toEqual([
            ["Buy", true],
            ["Knowledge", false],
            ["Test", false],
            ["Lead", true],
            ["Approve", false],
            ["Won", true],
            ["Invoice", true],
        ])
        expect(world.events.existsOfKindForLeads).toHaveBeenCalledWith("ws-1", "outcome.recorded", ["won-1"])
        expect(world.responsibilities.idsTitledLike).toHaveBeenCalledWith(
            "ws-1",
            ["Prepare invoice%", INVOICE_TITLE_PREFIX],
            5000,
        )
        expect(world.executions.hasApprovedAmong).toHaveBeenCalledWith("ws-1", ["r-1"])
    })
})

describe("PromoService state steps", () => {
    it("points every chatbot step at the install page when nothing is recorded", async () => {
        const world = await build()
        empty(world)

        await expect(world.promo.state("user-1", "ws-1")).resolves.toEqual({
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

describe("PromoService leadWait", () => {
    it("answers the wait of a website lead without a chatbot at the clock instant", async () => {
        const world = await build()
        empty(world)
        world.leads.listByIds.mockResolvedValue([LEAD])

        // created 2026-10-13T00:00Z, now 2026-10-13T02:00Z
        await expect(world.promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual({
            show: true,
            hours: 2,
            replied: false,
        })
        expect(world.leads.listByIds).toHaveBeenCalledWith("ws-1", ["lead-1"])
        expect(world.events.firstAtOfKind).toHaveBeenCalledWith("ws-1", "lead-1", "execution.approved")
    })

    it("stops the wait at the first approved reply", async () => {
        const world = await build()
        empty(world)
        world.leads.listByIds.mockResolvedValue([LEAD])
        world.events.firstAtOfKind.mockResolvedValue(new Date("2026-10-13T01:30:00.000Z"))

        await expect(world.promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual({
            show: true,
            hours: 1,
            replied: true,
        })
    })

    it("shows no hours for a wait shorter than an hour", async () => {
        const world = await build()
        empty(world)
        world.leads.listByIds.mockResolvedValue([LEAD])
        world.events.firstAtOfKind.mockResolvedValue(new Date("2026-10-13T00:20:00.000Z"))

        await expect(world.promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual({
            show: true,
            hours: null,
            replied: true,
        })
    })
})

describe("PromoService leadWait visibility", () => {
    it("hides the note for a missing lead", async () => {
        const world = await build()
        empty(world)
        world.leads.listByIds.mockResolvedValue([])

        await expect(world.promo.leadWait("user-1", "ws-1", "missing")).resolves.toEqual({
            show: false,
            hours: null,
            replied: false,
        })
    })

    it("hides the note for a lead of another channel", async () => {
        const world = await build()
        empty(world)
        world.leads.listByIds.mockResolvedValue([{ ...LEAD, channel: "Zalo" }])

        await expect(world.promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual({
            show: false,
            hours: null,
            replied: false,
        })
        expect(world.agents.earliestSheetOfModule).not.toHaveBeenCalled()
    })

    it("hides the note when the workspace has a chatbot", async () => {
        const world = await build()
        empty(world)
        world.agents.earliestSheetOfModule.mockResolvedValue(BOT)
        world.leads.listByIds.mockResolvedValue([LEAD])

        await expect(world.promo.leadWait("user-1", "ws-1", "lead-1")).resolves.toEqual({
            show: false,
            hours: null,
            replied: false,
        })
        expect(world.events.firstAtOfKind).not.toHaveBeenCalled()
    })
})

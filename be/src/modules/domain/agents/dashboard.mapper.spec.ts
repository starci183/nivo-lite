import { builder } from "@starci/jest-preset"
import type { BoundConnection } from "@modules/domain/agent-connections"
import type { LensCounts } from "./agents.contracts"
import type { Installation } from "./agents.port"
import {
    agentIdOf,
    agentOf,
    clip,
    connectionItemsOf,
    decisionHrefOf,
    itemOf,
    knowledgeOf,
    totalOf,
} from "./dashboard.mapper"
import type { DashboardItemRow } from "./persistence/dashboard.rows"

const rowOf = builder<DashboardItemRow>({
    id: "wi1",
    action: "reply_customer",
    lead_id: "l1",
    at: "2026-10-12T09:00:00.000Z",
    summary: "  Customer asks   the price ",
    customer: "An",
    result_href: null,
    total: "7",
})

const connectionOf = builder<BoundConnection>({
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    access: "auto",
    purpose: "inbound_chat",
    botUsername: "shop_bot",
    accountMasked: null,
})

const COUNTS: LensCounts = {
    audience: "customer",
    documents: { public: 2, internal: 1 },
    facts: { public: 3, internal: 2, restricted: 1 },
}

describe("dashboard mapper", () => {
    it("clips long text to an ellipsis and flattens white space", () => {
        expect(clip("a  b\n c", 10)).toBe("a b c")
        expect(clip("abcdefghij", 5)).toBe("abcd…")
    })

    it("builds the workbench link of a decision", () => {
        expect(decisionHrefOf("chatbot", "i1", "wi1")).toBe("/agents/chatbot/i1/workbench?focus=wi1")
        expect(decisionHrefOf("chatbot", null, "wi1")).toBe("/agents/chatbot/workbench?focus=wi1")
    })

    it("maps a work item row to a line", () => {
        expect(itemOf(rowOf(), "/agents/chatbot/i1/workbench?focus=wi1")).toEqual({
            id: "wi1",
            title: "Customer asks the price",
            action: "reply_customer",
            customer: "An",
            at: "2026-10-12T09:00:00.000Z",
            leadId: "l1",
            resultHref: null,
            decisionHref: "/agents/chatbot/i1/workbench?focus=wi1",
        })
    })

    it("fills what a row lacks and keeps a recorded href", () => {
        expect(itemOf(rowOf({ summary: null, customer: null, result_href: "/leads/l1" }), "/x")).toMatchObject({
            title: "",
            customer: "",
            resultHref: "/leads/l1",
        })
        expect(itemOf(rowOf({ result_href: "" }), "/x").resultHref).toBeNull()
    })

    it("reads the total of a page from its first row", () => {
        expect(totalOf([rowOf()])).toBe(7)
        expect(totalOf([])).toBe(0)
    })

    it("lists each connection once with a plain status", () => {
        const items = connectionItemsOf([
            connectionOf(),
            connectionOf(),
            connectionOf({ id: "c2", status: "error" }),
            connectionOf({ id: "c3", status: "pending" }),
        ])

        expect(items.map((item) => `${item.id}:${item.status}`)).toEqual(["c1:connected", "c2:error", "c3:pending"])
        expect(items[0]).toEqual({
            id: "c1",
            name: "Shop bot",
            provider: "telegram",
            botUsername: "shop_bot",
            accountMasked: null,
            status: "connected",
            access: "auto",
            purpose: "inbound_chat",
        })
    })

    it("builds the knowledge region with clipped gap questions, or none", () => {
        const gaps = {
            openCount: 4,
            items: [{ id: "g1", question: `${"q ".repeat(100)}`, count: 3, lastSeenAt: "2026-10-11T00:00:00.000Z" }],
        }

        expect(knowledgeOf(COUNTS, null)).toEqual({ ...COUNTS, gaps: null })
        const region = knowledgeOf(COUNTS, gaps)
        expect(region.gaps?.openCount).toBe(4)
        expect(region.gaps?.items[0]?.question.length).toBeLessThanOrEqual(120)
        expect(region.gaps?.items[0]?.count).toBe(3)
    })

    describe("the installed agent", () => {
        const installation: Installation = {
            id: "i1",
            workspaceId: "w1",
            module: "chatbot",
            name: "Chatbot Q1",
            isMulti: true,
            agentId: "a1",
            operatingMode: "assist",
            settings: {},
            activeContextVersionId: null,
        }

        it("names the agent of an installation", () => {
            expect(agentIdOf(installation)).toBe("a1")
            expect(agentOf(installation)).toEqual({ id: "a1", name: "Chatbot Q1", mode: "assist" })
        })

        it("has no agent without an installation or an agent row", () => {
            expect(agentIdOf(null)).toBeNull()
            expect(agentOf(null)).toBeNull()
            expect(agentIdOf({ ...installation, agentId: null })).toBeNull()
            expect(agentOf({ ...installation, agentId: null })).toBeNull()
        })
    })
})

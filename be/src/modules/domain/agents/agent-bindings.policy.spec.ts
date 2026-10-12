import { builder } from "@starci/jest-preset"
import type { BoundAgent } from "./agents.contracts"
import {
    boundAgentsOf,
    boundConnectionsOf,
    handoversFrom,
    isAccess,
    isPurpose,
    purposesOf,
    splitRoute,
} from "./agent-bindings.policy"
import type { BoundAgentRow, BoundConnectionRow } from "./persistence/agent-connections.rows"

const agentRow = builder<BoundAgentRow>({
    id: "a1",
    module: "chatbot",
    name: "Bot",
    created_at: "2026-10-01T00:00:00.000Z",
    access: "auto",
    purpose: "inbound_chat",
})

const connectionRow = builder<BoundConnectionRow>({
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    created_at: "2026-10-01T00:00:00.000Z",
    access: "ask",
    purpose: "outbound_chat",
})

const agentOf = builder<BoundAgent>({
    id: "a1",
    module: "chatbot",
    name: "Bot",
    access: "auto",
    purpose: "inbound_chat",
})

describe("agent bindings policy", () => {
    it("recognises purposes and access levels", () => {
        expect(isPurpose("tool")).toBe(true)
        expect(isPurpose("spam")).toBe(false)
        expect(isAccess("ask")).toBe(true)
        expect(isAccess("admin")).toBe(false)
    })

    it("takes one purpose or several", () => {
        expect(purposesOf("tool")).toEqual(["tool"])
        expect(purposesOf(["tool", "bank_feed"])).toEqual(["tool", "bank_feed"])
    })

    describe("boundAgentsOf", () => {
        it("lists the bound agents oldest first", () => {
            const rows = [
                agentRow({ id: "a2", created_at: "2026-10-02T00:00:00.000Z", name: "Second" }),
                agentRow({ id: "a1" }),
            ]

            expect(boundAgentsOf(rows, {}).map((agent) => agent.id)).toEqual(["a1", "a2"])
        })

        it("leaves out read-only bindings when acting and agents of other modules when asked", () => {
            const rows = [
                agentRow({ id: "a1", access: "read" }),
                agentRow({ id: "a2", module: "booking" }),
                agentRow({ id: "a3", access: "weird" }),
            ]

            expect(boundAgentsOf(rows, { acting: true, modules: ["booking", "chatbot"] }).map((a) => a.id)).toEqual([
                "a2",
            ])
            expect(boundAgentsOf(rows, { acting: false }).map((a) => `${a.id}:${a.access}`)).toEqual([
                "a1:read",
                "a2:auto",
                "a3:read",
            ])
            expect(boundAgentsOf(rows, { modules: ["booking"] }).map((a) => a.id)).toEqual(["a2"])
        })

        it("drops a binding with a purpose it does not know", () => {
            expect(boundAgentsOf([agentRow({ purpose: "unknown" })], {})).toEqual([])
        })
    })

    describe("boundConnectionsOf", () => {
        it("lists the connections that are not disconnected, oldest first", () => {
            const rows = [
                connectionRow({ id: "c2", created_at: "2026-10-02T00:00:00.000Z" }),
                connectionRow({ id: "c3", status: "disconnected" }),
                connectionRow({ id: "c1" }),
            ]

            expect(boundConnectionsOf(rows, {}).map((c) => c.id)).toEqual(["c1", "c2"])
        })

        it("applies the connected, acting and provider filters", () => {
            const rows = [
                connectionRow({ id: "c1", status: "error" }),
                connectionRow({ id: "c2", access: "read" }),
                connectionRow({ id: "c3", provider: "zalo_oa" }),
                connectionRow({ id: "c4", purpose: "unknown" }),
            ]

            expect(boundConnectionsOf(rows, { connectedOnly: true }).map((c) => c.id)).toEqual(["c2", "c3"])
            expect(boundConnectionsOf(rows, { acting: true }).map((c) => c.id)).toEqual(["c1", "c3"])
            expect(boundConnectionsOf(rows, { providers: ["zalo_oa"] }).map((c) => c.id)).toEqual(["c3"])
            expect(boundConnectionsOf([connectionRow()], {})).toEqual([
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Shop bot",
                    status: "connected",
                    access: "ask",
                    purpose: "outbound_chat",
                },
            ])
        })
    })

    describe("splitRoute", () => {
        it("makes the chatbot the front door and hands over to one agent per other module", () => {
            const route = splitRoute([
                agentOf({ id: "l1", module: "loyalty" }),
                agentOf({ id: "s1", module: "sales" }),
                agentOf({ id: "b1", module: "booking" }),
                agentOf({ id: "c1" }),
                agentOf({ id: "c2" }),
            ])

            expect(route.front?.id).toBe("c1")
            expect(route.handovers.map((agent) => agent.id)).toEqual(["b1", "l1"])
        })

        it("lets the first of the others answer without a chatbot, and nobody when none is bound", () => {
            expect(
                splitRoute([agentOf({ id: "l1", module: "loyalty" }), agentOf({ id: "b1", module: "booking" })]).front
                    ?.id,
            ).toBe("b1")
            expect(splitRoute([agentOf({ module: "sales" })])).toEqual({ front: null, handovers: [] })
        })
    })

    it("hands over to the bound agents of another module", () => {
        const bound = [agentOf({ id: "a1" }), agentOf({ id: "a2", module: "booking" })]

        expect(handoversFrom(bound, "chatbot").map((agent) => agent.id)).toEqual(["a2"])
    })
})

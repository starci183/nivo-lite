import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { BoundAgent, BoundAgentFacts, BoundConnectionFacts } from "./agent-connections.contracts"
import {
    boundAgentsOf as boundAgentsOfImplementation,
    boundConnectionsOf as boundConnectionsOfImplementation,
    handoversFrom as handoversFromImplementation,
    isAccess as isAccessImplementation,
    isPurpose as isPurposeImplementation,
    purposesOf as purposesOfImplementation,
    splitRoute as splitRouteImplementation,
} from "./agent-bindings.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    boundAgentsOf: typeof boundAgentsOfImplementation
    boundConnectionsOf: typeof boundConnectionsOfImplementation
    handoversFrom: typeof handoversFromImplementation
    isAccess: typeof isAccessImplementation
    isPurpose: typeof isPurposeImplementation
    purposesOf: typeof purposesOfImplementation
    splitRoute: typeof splitRouteImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    boundAgentsOf: boundAgentsOfImplementation,
                    boundConnectionsOf: boundConnectionsOfImplementation,
                    handoversFrom: handoversFromImplementation,
                    isAccess: isAccessImplementation,
                    isPurpose: isPurposeImplementation,
                    purposesOf: purposesOfImplementation,
                    splitRoute: splitRouteImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const agentRow = builder<BoundAgentFacts>({
    id: "a1",
    module: "chatbot",
    name: "Bot",
    created_at: "2026-10-01T00:00:00.000Z",
    access: "auto",
    purpose: "inbound_chat",
})

const connectionRow = builder<BoundConnectionFacts>({
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    created_at: "2026-10-01T00:00:00.000Z",
    access: "ask",
    purpose: "outbound_chat",
    bot_username: null,
    account_masked: null,
})

const agentOf = builder<BoundAgent>({
    id: "a1",
    module: "chatbot",
    name: "Bot",
    access: "auto",
    purpose: "inbound_chat",
})

describe("agent bindings policy", () => {
    it("recognises purposes and access levels", async () => {
        const subject = await buildSubject()

        expect(subject.isPurpose("tool")).toBe(true)
        expect(subject.isPurpose("spam")).toBe(false)
        expect(subject.isAccess("ask")).toBe(true)
        expect(subject.isAccess("admin")).toBe(false)
    })

    it("takes one purpose or several", async () => {
        const subject = await buildSubject()

        expect(subject.purposesOf("tool")).toEqual(["tool"])
        expect(subject.purposesOf(["tool", "bank_feed"])).toEqual(["tool", "bank_feed"])
    })

    describe("boundAgentsOf", () => {
        it("lists the bound agents oldest first", async () => {
            const subject = await buildSubject()

            const rows = [
                agentRow({ id: "a2", created_at: "2026-10-02T00:00:00.000Z", name: "Second" }),
                agentRow({ id: "a1" }),
            ]

            expect(subject.boundAgentsOf(rows, {}).map((agent) => agent.id)).toEqual(["a1", "a2"])
        })

        it("leaves out read-only bindings when acting and agents of other modules when asked", async () => {
            const subject = await buildSubject()

            const rows = [
                agentRow({ id: "a1", access: "read" }),
                agentRow({ id: "a2", module: "booking" }),
                agentRow({ id: "a3", access: "weird" }),
            ]

            expect(
                subject.boundAgentsOf(rows, { acting: true, modules: ["booking", "chatbot"] }).map((a) => a.id),
            ).toEqual(["a2"])
            expect(subject.boundAgentsOf(rows, { acting: false }).map((a) => `${a.id}:${a.access}`)).toEqual([
                "a1:read",
                "a2:auto",
                "a3:read",
            ])
            expect(subject.boundAgentsOf(rows, { modules: ["booking"] }).map((a) => a.id)).toEqual(["a2"])
        })

        it("drops a binding with a purpose it does not know", async () => {
            const subject = await buildSubject()

            expect(subject.boundAgentsOf([agentRow({ purpose: "unknown" })], {})).toEqual([])
        })
    })
})

describe("agent bindings policy", () => {
    describe("boundConnectionsOf", () => {
        it("lists the connections that are not disconnected, oldest first", async () => {
            const subject = await buildSubject()

            const rows = [
                connectionRow({ id: "c2", created_at: "2026-10-02T00:00:00.000Z" }),
                connectionRow({ id: "c3", status: "disconnected" }),
                connectionRow({ id: "c1" }),
            ]

            expect(subject.boundConnectionsOf(rows, {}).map((c) => c.id)).toEqual(["c1", "c2"])
        })

        it("applies the connected, acting and provider filters", async () => {
            const subject = await buildSubject()

            const rows = [
                connectionRow({ id: "c1", status: "error" }),
                connectionRow({ id: "c2", access: "read" }),
                connectionRow({ id: "c3", provider: "zalo_oa" }),
                connectionRow({ id: "c4", purpose: "unknown" }),
            ]

            expect(subject.boundConnectionsOf(rows, { connectedOnly: true }).map((c) => c.id)).toEqual(["c2", "c3"])
            expect(subject.boundConnectionsOf(rows, { acting: true }).map((c) => c.id)).toEqual(["c1", "c3"])
            expect(subject.boundConnectionsOf(rows, { providers: ["zalo_oa"] }).map((c) => c.id)).toEqual(["c3"])
            expect(subject.boundConnectionsOf([connectionRow()], {})).toEqual([
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Shop bot",
                    botUsername: null,
                    accountMasked: null,
                    status: "connected",
                    access: "ask",
                    purpose: "outbound_chat",
                },
            ])
        })
    })

    describe("splitRoute", () => {
        it("makes the chatbot the front door and hands over to one agent per other module", async () => {
            const subject = await buildSubject()

            const route = subject.splitRoute([
                agentOf({ id: "l1", module: "loyalty" }),
                agentOf({ id: "s1", module: "sales" }),
                agentOf({ id: "b1", module: "booking" }),
                agentOf({ id: "c1" }),
                agentOf({ id: "c2" }),
            ])

            expect(route.front?.id).toBe("c1")
            expect(route.handovers.map((agent) => agent.id)).toEqual(["b1", "l1", "s1"])
        })

        it("lets the first of the others answer without a chatbot, and nobody when none is bound", async () => {
            const subject = await buildSubject()

            expect(
                subject.splitRoute([agentOf({ id: "l1", module: "loyalty" }), agentOf({ id: "b1", module: "booking" })])
                    .front?.id,
            ).toBe("b1")
            expect(subject.splitRoute([agentOf({ id: "s1", module: "sales" })]).front?.id).toBe("s1")
            expect(subject.splitRoute([agentOf({ module: "accounting" })])).toEqual({ front: null, handovers: [] })
        })
    })

    it("hands over to the bound agents of another module", async () => {
        const subject = await buildSubject()

        const bound = [agentOf({ id: "a1" }), agentOf({ id: "a2", module: "booking" })]

        expect(subject.handoversFrom(bound, "chatbot").map((agent) => agent.id)).toEqual(["a2"])
    })
})

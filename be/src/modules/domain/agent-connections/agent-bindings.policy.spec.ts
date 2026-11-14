import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { BoundAgent, BoundAgentFacts, BoundConnectionFacts } from "./agent-connections.contracts"
import {
    boundAgentsOf as boundAgentsOfImplementation,
    boundConnectionsOf as boundConnectionsOfImplementation,
    isPurpose as isPurposeImplementation,
    purposesOf as purposesOfImplementation,
    routeOf as routeOfImplementation,
} from "./agent-bindings.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    boundAgentsOf: typeof boundAgentsOfImplementation
    boundConnectionsOf: typeof boundConnectionsOfImplementation
    isPurpose: typeof isPurposeImplementation
    purposesOf: typeof purposesOfImplementation
    routeOf: typeof routeOfImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    boundAgentsOf: boundAgentsOfImplementation,
                    boundConnectionsOf: boundConnectionsOfImplementation,
                    isPurpose: isPurposeImplementation,
                    purposesOf: purposesOfImplementation,
                    routeOf: routeOfImplementation,
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
    purpose: "inbound_chat",
})

const connectionRow = builder<BoundConnectionFacts>({
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    created_at: "2026-10-01T00:00:00.000Z",
    purpose: "outbound_chat",
    bot_username: null,
    account_masked: null,
})

const agentOf = builder<BoundAgent>({
    id: "a1",
    module: "chatbot",
    name: "Bot",
    purpose: "inbound_chat",
})

describe("agent bindings policy", () => {
    it("recognises purposes and access levels", async () => {
        const subject = await buildSubject()

        expect(subject.isPurpose("tool")).toBe(true)
        expect(subject.isPurpose("spam")).toBe(false)
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

            expect(subject.boundAgentsOf(rows).map((agent) => agent.id)).toEqual(["a1", "a2"])
        })

        it("counts every binding (a binding routes; rights live in attachments)", async () => {
            const subject = await buildSubject()

            const rows = [
                agentRow({ id: "a1" }),
                agentRow({ id: "a2", module: "booking" }),
                agentRow({ id: "a3" }),
            ]

            expect(subject.boundAgentsOf(rows).map((a) => a.id)).toEqual(["a1", "a2", "a3"])
        })

        it("drops a binding with a purpose it does not know", async () => {
            const subject = await buildSubject()

            expect(subject.boundAgentsOf([agentRow({ purpose: "unknown" })])).toEqual([])
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
                connectionRow({ id: "c2" }),
                connectionRow({ id: "c3", provider: "zalo_oa" }),
                connectionRow({ id: "c4", purpose: "unknown" }),
            ]

            expect(subject.boundConnectionsOf(rows, { connectedOnly: true }).map((c) => c.id)).toEqual(["c2", "c3"])
            expect(subject.boundConnectionsOf(rows, { providers: ["zalo_oa"] }).map((c) => c.id)).toEqual(["c3"])
            expect(subject.boundConnectionsOf([connectionRow()], {})).toEqual([
                {
                    id: "c1",
                    provider: "telegram",
                    name: "Shop bot",
                    botUsername: null,
                    accountMasked: null,
                    status: "connected",
                    purpose: "outbound_chat",
                },
            ])
        })
    })
})

describe("agent bindings policy", () => {
    describe("routeOf", () => {
        it("makes the oldest bound inbound agent the one front door, with nobody to hand over to", async () => {
            const subject = await buildSubject()

            const route = subject.routeOf([agentOf({ id: "c1" }), agentOf({ id: "c2" })])

            expect(route.front?.id).toBe("c1")
            expect(route.handovers).toEqual([])
        })

        it("answers no front door when nobody is bound", async () => {
            const subject = await buildSubject()

            expect(subject.routeOf([])).toEqual({ front: null, handovers: [] })
        })
    })
})

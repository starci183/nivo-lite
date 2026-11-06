import { Test } from "@nestjs/testing"
import {
    byCustomer,
    byId,
    conversationQuery,
    factsOf,
    humanOf,
    oneConversationQuery,
    partyOfFacts,
    plainFactsOf,
    refOf,
    stateOf,
    targetOf,
} from "./chat-conversation.policy"

/** The members of the subject under test. */
interface Subject {
    readonly byCustomer: typeof byCustomer
    readonly byId: typeof byId
    readonly conversationQuery: typeof conversationQuery
    readonly factsOf: typeof factsOf
    readonly humanOf: typeof humanOf
    readonly oneConversationQuery: typeof oneConversationQuery
    readonly partyOfFacts: typeof partyOfFacts
    readonly plainFactsOf: typeof plainFactsOf
    readonly refOf: typeof refOf
    readonly stateOf: typeof stateOf
    readonly targetOf: typeof targetOf
}

const SUBJECT = Symbol("chat-conversation.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    byCustomer,
                    byId,
                    conversationQuery,
                    factsOf,
                    humanOf,
                    oneConversationQuery,
                    partyOfFacts,
                    plainFactsOf,
                    refOf,
                    stateOf,
                    targetOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const data = {
    channel: "zalo",
    connectionId: "k1",
    externalId: "u1",
    name: "",
    waiting: true,
    handledBy: "Lan",
    lastText: "hi",
    lastRole: "user",
    lastAt: "2026-11-06T03:00:00.000Z",
    messageCount: 2,
    agentId: "a1",
}

const row = (extra: Record<string, unknown> = {}) => ({
    id: "c1",
    workspaceId: "w1",
    version: "4",
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
    data: { ...data, ...extra },
})

describe("chat conversation policy: reading", () => {
    it("reads the facts of a conversation with its lead link", async () => {
        const policy = await build()
        const facts = policy.factsOf({ row: row(), joined: { lead: { id: "l1", data: {} } } })
        expect(facts).toMatchObject({ id: "c1", version: "4", workspaceId: "w1", agentId: "a1", leadId: "l1" })
        expect(policy.plainFactsOf(row())?.leadId).toBeNull()
    })

    it("reads nothing from a record with no speaking agent or other fields", async () => {
        const policy = await build()
        expect(policy.plainFactsOf(row({ agentId: null }))).toBeNull()
        expect(policy.plainFactsOf(row({ channel: 4 }))).toBeNull()
    })
})

describe("chat conversation policy: views", () => {
    it("maps the facts to the ref, the target, the human view and the state of the rules", async () => {
        const policy = await build()
        const facts = policy.plainFactsOf(row())
        const named = policy.plainFactsOf(row({ name: "An" }))
        expect(facts && policy.refOf(facts)).toEqual({
            id: "c1",
            agentId: "a1",
            leadId: null,
            handledBy: "Lan",
            visitorName: null,
        })
        expect(named && policy.refOf(named).visitorName).toBe("An")
        expect(facts && policy.targetOf(facts)).toEqual({
            id: "c1",
            workspaceId: "w1",
            channel: "zalo",
            externalId: "u1",
            connectionId: "k1",
        })
        expect(facts && policy.humanOf(facts)).toMatchObject({ id: "c1", leadId: null, handledBy: "Lan" })
        expect(facts && policy.stateOf(facts)).toEqual({
            lastText: "hi",
            lastRole: "user",
            lastAt: "2026-11-06T03:00:00.000Z",
            messageCount: 2,
            waiting: true,
            handledBy: "Lan",
        })
    })

    it("builds the queries of one conversation and of one customer", async () => {
        const policy = await build()
        expect(policy.byId("c1")).toEqual({ op: "eq", field: "id", value: "c1" })
        expect(policy.byCustomer("zalo", "k1", "u1")).toMatchObject({ op: "and" })
        expect(policy.oneConversationQuery(policy.byId("c1"))).toMatchObject({
            from: "chat.conversation",
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        expect(policy.conversationQuery(policy.byId("c1"), 1)).toMatchObject({
            from: "chat.conversation",
            join: { lead: ["contactName"] },
            page: { size: 1 },
        })
    })
})

describe("chat conversation policy: the connector party", () => {
    it("reads the party a conversation remembers, an empty name for none, and nothing for no conversation", async () => {
        const policy = await build()
        const withParty = policy.plainFactsOf(row({ connectorPartyId: "p1", connectorPartyName: "Cty A" }))
        const unnamed = policy.plainFactsOf(row({ connectorPartyId: "p2" }))
        expect(policy.partyOfFacts(withParty)).toEqual({ partyId: "p1", name: "Cty A" })
        expect(policy.partyOfFacts(unnamed)).toEqual({ partyId: "p2", name: "" })
        expect(policy.partyOfFacts(policy.plainFactsOf(row()))).toBeNull()
        expect(policy.partyOfFacts(null)).toBeNull()
    })
})

describe("chat conversation policy: nullable keys", () => {
    it("reads a connection that is null as no connection", async () => {
        const policy = await build()
        const facts = policy.plainFactsOf(row({ connectionId: null, externalId: null }))
        expect(facts && policy.targetOf(facts)).toMatchObject({ connectionId: null, externalId: null })
    })
})

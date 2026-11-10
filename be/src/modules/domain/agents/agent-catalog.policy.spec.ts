import { Test } from "@nestjs/testing"
import { catalogAgentOf, catalogKnowledgeOf, grantsOfAgent } from "./agent-catalog.policy"
import type { AgentGrantView } from "./agents.port"

const grantOf = (agentId: string, id: string, purpose: AgentGrantView["connection"]["purpose"]): AgentGrantView => ({
    agentId,
    connection: {
        id,
        provider: "sepay",
        name: `Account ${id}`,
        botUsername: null,
        accountMasked: "***9999",
        status: "connected",
        purpose,
    },
})

interface Subject {
    grantsOfAgent: typeof grantsOfAgent
    catalogKnowledgeOf: typeof catalogKnowledgeOf
    catalogAgentOf: typeof catalogAgentOf
}

const SUBJECT = Symbol("agent-catalog.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { grantsOfAgent, catalogKnowledgeOf, catalogAgentOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("grantsOfAgent", () => {
    it("keeps the grants of the agent only, one entry per grant", async () => {
        const subject = await buildSubject()
        const grants = [grantOf("a1", "c1", "bank_feed"), grantOf("a2", "c1", "data_source"), grantOf("a1", "c1", "tool")]

        expect(subject.grantsOfAgent("a1", grants).map((grant) => [grant.connectionId, grant.purpose])).toEqual([
            ["c1", "bank_feed"],
            ["c1", "tool"],
        ])
        expect(subject.grantsOfAgent("a3", grants)).toEqual([])
    })
})

describe("catalogKnowledgeOf", () => {
    it("counts the documents of the lens and the facts approved out of all, waiting included", async () => {
        const subject = await buildSubject()
        const counts = {
            audience: "internal" as const,
            documents: { public: 2, internal: 4 },
            facts: { public: 0, internal: 0, restricted: 0 },
        }

        expect(subject.catalogKnowledgeOf(counts, 63)).toEqual({
            audience: "internal",
            documents: 6,
            factsApproved: 0,
            factsTotal: 63,
            factsWaiting: 63,
        })
    })

    it("sums the approved facts of every scope", async () => {
        const subject = await buildSubject()
        const counts = {
            audience: "customer" as const,
            documents: { public: 2, internal: 0 },
            facts: { public: 9, internal: 3, restricted: 2 },
        }

        expect(subject.catalogKnowledgeOf(counts, 1)).toMatchObject({ factsApproved: 14, factsTotal: 15, documents: 2 })
    })
})

describe("catalogAgentOf", () => {
    it("joins the instance, its grants and its knowledge", async () => {
        const subject = await buildSubject()
        const knowledge = subject.catalogKnowledgeOf(
            {
                audience: "internal",
                documents: { public: 1, internal: 1 },
                facts: { public: 0, internal: 0, restricted: 0 },
            },
            0,
        )

        expect(subject.catalogAgentOf("a1", "i1", [grantOf("a1", "c1", "tool")], knowledge)).toMatchObject({
            agentId: "a1",
            installationId: "i1",
            grants: [{ connectionId: "c1" }],
            knowledge: { documents: 2 },
        })
    })
})

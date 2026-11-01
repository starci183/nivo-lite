import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import type { AgentGraphView } from "../agent-graphs.contracts"
import type { RunEntry } from "../agent-graph-decisions.service"
import { localeOf, runEntryWireOf, wireOfView } from "./graph-wire.policy"

/** The members of the subject under test. */
interface Subject {
    readonly localeOf: typeof localeOf
    readonly wireOfView: typeof wireOfView
    readonly runEntryWireOf: typeof runEntryWireOf
}

const SUBJECT = Symbol("graph-wire.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { localeOf, wireOfView, runEntryWireOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const VIEW: AgentGraphView = {
    agentId: "agent-1",
    installationId: "inst-1",
    mode: "shadow",
    draft: graphOf(OWNER_EXAMPLE),
    draftRev: 3,
    isDraftChanged: true,
    activeVersionId: "version-1",
    gaps: [{ code: "else_unset", nodeKey: "decide", branchKey: null }],
    problems: [],
    cards: [],
    proposals: [],
    warnings: [],
    facts: [{ key: "order.amount_vnd", label: "the order amount", type: "number", unit: "vnd", allowed: [] }],
    unheldRules: [{ amountVnd: 5_000_000, quote: "Over 5 trieu ask the owner" }],
}

const RUN: RunEntry = {
    id: "decision-1",
    road: "reply",
    mode: "enforced",
    action: "reply_customer",
    versionId: "version-1",
    branchKey: "decide",
    outcome: "ask",
    gateVerdict: null,
    closedAs: "stopped",
    differs: true,
    unread: ["outgoing.amount_vnd"],
    unjudged: "fact_unread",
    facts: { "outgoing.length": 12 },
    path: ["decide", "approval"],
    workItemId: null,
    subjectType: "conversation",
    subjectId: "conv-1",
    createdAt: "2026-11-01T01:00:00.000Z",
}

describe("graph-wire.policy", () => {
    it("reads English only when it is named", async () => {
        const subject = await build()

        expect(subject.localeOf("en")).toBe("en")
        expect(subject.localeOf("vi")).toBe("vi")
        expect(subject.localeOf(null)).toBe("vi")
        expect(subject.localeOf("fr")).toBe("vi")
    })

    it("sends the structured parts as JSON text and the rest as they are", async () => {
        const subject = await build()

        const wire = subject.wireOfView(VIEW)

        expect(wire).toMatchObject({
            agentId: "agent-1",
            installationId: "inst-1",
            mode: "shadow",
            draftRev: 3,
            isDraftChanged: true,
            activeVersionId: "version-1",
        })
        expect(wire.draftJson).toBe(JSON.stringify(VIEW.draft))
        expect(wire.gapsJson).toBe('[{"code":"else_unset","nodeKey":"decide","branchKey":null}]')
        expect([wire.problemsJson, wire.cardsJson, wire.proposalsJson]).toEqual(["[]", "[]", "[]"])
        expect(wire.factsJson).toBe(JSON.stringify(VIEW.facts))
        expect(wire.unheldRulesJson).toBe(JSON.stringify(VIEW.unheldRules))
    })

    it("sends a run of the listing with its version number and its structured parts as JSON text", async () => {
        const subject = await build()

        expect(subject.runEntryWireOf(RUN, 4)).toEqual({
            id: "decision-1",
            road: "reply",
            mode: "enforced",
            action: "reply_customer",
            version: 4,
            branchKey: "decide",
            outcome: "ask",
            gateVerdict: null,
            closedAs: "stopped",
            differs: true,
            unjudged: "fact_unread",
            unreadJson: JSON.stringify(["outgoing.amount_vnd"]),
            factsJson: JSON.stringify({ "outgoing.length": 12 }),
            pathJson: JSON.stringify(["decide", "approval"]),
            workItemId: null,
            subjectType: "conversation",
            subjectId: "conv-1",
            createdAt: "2026-11-01T01:00:00.000Z",
        })
        expect(subject.runEntryWireOf(RUN, null).version).toBeNull()
    })
})

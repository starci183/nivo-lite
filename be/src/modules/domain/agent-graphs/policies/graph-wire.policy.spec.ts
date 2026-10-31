import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import type { AgentGraphView } from "../agent-graphs.contracts"
import { localeOf, wireOfView } from "./graph-wire.policy"

/** The members of the subject under test. */
interface Subject {
    readonly localeOf: typeof localeOf
    readonly wireOfView: typeof wireOfView
}

const SUBJECT = Symbol("graph-wire.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { localeOf, wireOfView } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const VIEW: AgentGraphView = {
    agentId: "agent-1",
    installationId: "inst-1",
    mode: "shadow",
    draft: graphOf(OWNER_EXAMPLE),
    draftRev: 3,
    activeVersionId: "version-1",
    gaps: [{ code: "else_unset", nodeKey: "decide", branchKey: null }],
    problems: [],
    cards: [],
    proposals: [],
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

        expect(wire).toMatchObject({ agentId: "agent-1", installationId: "inst-1", mode: "shadow", draftRev: 3, activeVersionId: "version-1" })
        expect(wire.draftJson).toBe(JSON.stringify(VIEW.draft))
        expect(wire.gapsJson).toBe('[{"code":"else_unset","nodeKey":"decide","branchKey":null}]')
        expect([wire.problemsJson, wire.cardsJson, wire.proposalsJson]).toEqual(["[]", "[]", "[]"])
    })
})

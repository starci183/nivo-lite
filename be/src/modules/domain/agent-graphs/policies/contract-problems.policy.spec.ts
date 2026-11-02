import { Test } from "@nestjs/testing"
import type { IntentBusiness } from "@modules/domain/intent-contracts"
import { END, TRIGGER, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import type { GraphDocument } from "../agent-graphs.contracts"
import { contractProblems, contractWarnings } from "./contract-problems.policy"

const SUBJECT = Symbol("contract-problems.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { contractProblems, contractWarnings } }],
    }).compile()
    return moduleRef.get<{
        contractProblems: typeof contractProblems
        contractWarnings: typeof contractWarnings
    }>(SUBJECT)
}

const FRAMED: ReadonlyArray<string> = ["send_quote", "reply_customer"]
const hasFrame = (intent: string): boolean => FRAMED.includes(intent)

const graphWith = (action: string, contracts: ReadonlyArray<IntentBusiness> = []): GraphDocument => ({
    nodes: [nodeOf({ ...TRIGGER, key: "start", next: ["act"] }), nodeOf({ key: "act", action, next: ["end"] }), END],
    rights: [],
    contracts,
})

const business = (patch: Partial<IntentBusiness>): IntentBusiness => ({
    intent: "send_quote",
    task: "Quote the work.",
    limits: [],
    sources: [],
    ...patch,
})

describe("contractProblems", () => {
    it("has none for a graph whose intents are in the catalogue and whose trigger reaches one", async () => {
        const subject = await build()

        expect(subject.contractProblems(graphWith("send_quote"), hasFrame)).toEqual([])
    })

    it("refuses an intent the catalogue has no frame for, naming the node and the intent", async () => {
        const subject = await build()

        expect(subject.contractProblems(graphWith("invent_work"), hasFrame)).toEqual([
            { code: "intent_no_frame", nodeKey: "act", branchKey: null, detail: "invent_work" },
        ])
    })

    it("refuses a customer message or a tag that reaches no intent, and leaves the other triggers alone", async () => {
        const subject = await build()
        const idle: GraphDocument = {
            nodes: [
                nodeOf({ ...TRIGGER, key: "start", next: ["end"] }),
                nodeOf({ ...TRIGGER, key: "tag", step: "tag", next: ["end"] }),
                nodeOf({ ...TRIGGER, key: "clock", step: "schedule", next: ["end"] }),
                END,
            ],
            rights: [],
        }

        expect(subject.contractProblems(idle, hasFrame)).toEqual([
            { code: "trigger_no_intent", nodeKey: "start", branchKey: null, detail: "" },
            { code: "trigger_no_intent", nodeKey: "tag", branchKey: null, detail: "" },
        ])
    })
})

describe("contractWarnings", () => {
    it("has none for a graph with no contracts block, so a shipped graph and a rollback still publish", async () => {
        const subject = await build()
        const shipped: GraphDocument = { nodes: graphWith("send_quote").nodes, rights: [] }

        expect(subject.contractWarnings(shipped)).toEqual([])
    })

    it("warns of a contract for an intent the graph does not hold and of one with no task", async () => {
        const subject = await build()
        const graph = graphWith("send_quote", [business({ intent: "give_discount" }), business({ task: "  " })])

        expect(subject.contractWarnings(graph)).toEqual([
            { code: "contract_unknown_intent", nodeKey: "", branchKey: null, detail: "give_discount" },
            { code: "contract_no_task", nodeKey: "", branchKey: null, detail: "send_quote" },
        ])
    })
})

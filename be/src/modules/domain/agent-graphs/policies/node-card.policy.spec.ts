import { Test } from "@nestjs/testing"
import { branchOf, decideOf, nodeOf, say } from "@tests/fixtures/builders/agent-graph.builder"
import { CARD_LINE_MAX, cardLineOf, flowNodeCardOf, nodeCardOf, sourceWord } from "./node-card.policy"

/** The members of the subject under test. */
interface Subject {
    readonly nodeCardOf: typeof nodeCardOf
    readonly cardLineOf: typeof cardLineOf
    readonly sourceWord: typeof sourceWord
    readonly flowNodeCardOf: typeof flowNodeCardOf
}

const SUBJECT = Symbol("node-card.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nodeCardOf, cardLineOf, sourceWord, flowNodeCardOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const short = (_key: string, params?: Readonly<Record<string, string | number>>): string =>
    `${params?.name ?? ""} approves`

const SEPAY = { provider: "sepay", tool: "sepay.status.get", scope: "read", label: "SePay" } as const

describe("node-card.policy", () => {
    it.each([
        ["trigger", "customer_message", "neutral"],
        ["trigger", "tag", "neutral"],
        ["trigger", "event", "neutral"],
        ["trigger", "schedule", "neutral"],
        ["execute", "read_context", "accent"],
        ["condition", "evaluate", "warning"],
        ["execute", "call", "accent"],
        ["output", "reply", "success"],
        ["output", "approval", "warning"],
        ["output", "write", "success"],
        ["output", "stop", "muted"],
    ] as const)("paints a %s node of step %s %s and carries both on the card", async (kind, step, tone) => {
        const subject = await build()

        expect(subject.nodeCardOf(nodeOf({ kind, step }), null, say)).toMatchObject({ kind, step, tone })
    })

    it("draws a decision as a diamond, a step a person answers as round and the rest as a rectangle", async () => {
        const subject = await build()

        expect(subject.nodeCardOf(decideOf([]), null, say).shape).toBe("diamond")
        expect(subject.nodeCardOf(nodeOf({ step: "approval", doneBy: "person" }), null, say).shape).toBe("round")
        expect(subject.nodeCardOf(nodeOf({ step: "reply", doneBy: "person" }), null, say).shape).toBe("round")
        expect(subject.nodeCardOf(nodeOf({ step: "approval", doneBy: "nivo" }), null, say).shape).toBe("round")
        expect(subject.nodeCardOf(nodeOf({ step: "call", doneBy: "agent" }), null, say).shape).toBe("rect")
    })

    it("reads the rule behind a node as one word, the owner own edit first", async () => {
        const subject = await build()

        expect(
            subject.sourceWord(
                nodeOf({ sources: [{ kind: "brain", factId: "f", passage: "p", valueHash: "h" }] }),
                say,
            ),
        ).toBe("agentGraphs.source.brain")
        expect(subject.sourceWord(nodeOf({ sources: [{ kind: "template", key: "t", version: 1 }] }), say)).toBe(
            "agentGraphs.source.template",
        )
        expect(subject.sourceWord(nodeOf({ sources: [] }), say)).toBe("")
        expect(
            subject.sourceWord(
                nodeOf({
                    sources: [{ kind: "learned", proposalId: "p" }],
                    decide: { intent: "x", facts: [], branches: [branchOf({ selfCorrected: true })] },
                }),
                say,
            ),
        ).toBe("agentGraphs.source.corrected")
        expect(
            subject.sourceWord(
                nodeOf({ decide: { intent: "x", facts: [], branches: [branchOf({ selfCorrected: false })] } }),
                say,
            ),
        ).toBe("agentGraphs.source.rule")
    })
})

describe("node-card.policy (continued)", () => {
    it("builds the line from the tool and who approves, and never past 36 characters", async () => {
        const subject = await build()

        expect(subject.cardLineOf(nodeOf({ uses: [SEPAY] }), null, say)).toBe("SePay")
        expect(subject.cardLineOf(nodeOf({ uses: [] }), "Dinh", short)).toBe("Dinh approves")
        expect(subject.cardLineOf(nodeOf({ uses: [SEPAY] }), "Dinh", short)).toBe("SePay · Dinh approves")
        expect(subject.cardLineOf(nodeOf({ uses: [] }), null, say)).toBe("")
        const long = subject.cardLineOf(
            nodeOf({ uses: [{ ...SEPAY, label: "A provider with a very long name" }] }),
            "Mr Nam",
            short,
        )

        expect(long.length).toBeLessThanOrEqual(CARD_LINE_MAX)
        expect(long.endsWith("…")).toBe(true)
    })

    it("marks a placeholder tool so the card draws it as not live", async () => {
        const subject = await build()

        expect(subject.nodeCardOf(nodeOf({ uses: [{ ...SEPAY, placeholder: true }] }), null, say).isPlaceholder).toBe(
            true,
        )
        expect(subject.nodeCardOf(nodeOf({ uses: [SEPAY] }), null, say)).toMatchObject({
            id: "act",
            label: "Record the payment",
            isPlaceholder: false,
            count: "agentGraphs.source.rule",
        })
    })
})

describe("flowNodeCardOf", () => {
    it("draws a flow node with its installed title, its group and what it waits for", async () => {
        const { flowNodeCardOf } = await build()
        const wait = { kind: "payment", timeout: "24h", reminder: "2h" } as const
        expect(
            flowNodeCardOf(
                { key: "await-payment", kind: "execute", step: "sales.care-await-payment", group: "care", wait },
                "Wait",
            ),
        ).toEqual({
            id: "await-payment",
            label: "Wait",
            description: "sales.care-await-payment",
            tone: "accent",
            kind: "execute",
            step: "call",
            shape: "round",
            count: "",
            isPlaceholder: false,
            group: "care",
            wait,
        })
    })

    it("draws a route as a decision, an output as a write and the stop as the end, titled by its key when nothing names it", async () => {
        const { flowNodeCardOf } = await build()
        const route = flowNodeCardOf(
            { key: "consult-route", kind: "condition", step: "sales.consult-route", group: "consult" },
            null,
        )
        expect(route).toMatchObject({ label: "consult-route", step: "evaluate", shape: "diamond", group: "consult" })
        expect(flowNodeCardOf({ key: "consult", kind: "output", step: "sales.consult" }, "Consult")).not.toHaveProperty(
            "group",
        )
        expect(flowNodeCardOf({ key: "end", kind: "output", step: "stop" }, null).step).toBe("stop")
    })
})

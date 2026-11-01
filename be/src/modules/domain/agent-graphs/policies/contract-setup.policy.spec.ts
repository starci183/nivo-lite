import { Test } from "@nestjs/testing"
import { contractsFromSetup, factLineOf } from "./contract-setup.policy"
import type { SetupProposal } from "../agent-graph-contract-setup.schema"
import type { SetupFact } from "./contract-setup.policy"
import { valueHashOf } from "./conflict.policy"

const SUBJECT = Symbol("contract-setup.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { contractsFromSetup, factLineOf } }],
    }).compile()
    return moduleRef.get<{ contractsFromSetup: typeof contractsFromSetup; factLineOf: typeof factLineOf }>(SUBJECT)
}

const DEPOSIT: SetupFact = { id: "f1", subject: "Deposit", attribute: "Rate", value: "30% of the booking" }
const FACTS: ReadonlyArray<SetupFact> = [
    DEPOSIT,
    { id: "f2", subject: "Delivery", attribute: "Area", value: "Inside the city only" },
]

const proposal = (contracts: SetupProposal["contracts"]): SetupProposal => ({ contracts })

const entry = (patch: Partial<SetupProposal["contracts"][number]> = {}): SetupProposal["contracts"][number] => ({
    intent: "reply_customer",
    task: "A booking means a deposit.",
    task_fact_ids: ["f1"],
    limits: [{ text: "Deposit is 30%.", triggers: ["customer_message"], audiences: [], fact_ids: ["f1"] }],
    ...patch,
})

describe("factLineOf", () => {
    it("writes the id first so the model can cite it, and bounds a long value", async () => {
        const subject = await build()

        expect(subject.factLineOf(DEPOSIT)).toBe("f1 | Deposit | Rate: 30% of the booking")
        expect(subject.factLineOf({ ...DEPOSIT, value: "x".repeat(900) }).length).toBeLessThan(330)
    })
})

describe("contractsFromSetup", () => {
    it("builds the business half with each limit citing the Brain facts that state it", async () => {
        const subject = await build()

        const [built] = subject.contractsFromSetup(proposal([entry()]), FACTS, ["reply_customer"])

        const source = {
            kind: "brain",
            factId: "f1",
            passage: "30% of the booking",
            valueHash: valueHashOf("30% of the booking"),
        }
        expect(built?.business).toEqual({
            intent: "reply_customer",
            task: "A booking means a deposit.",
            limits: [{ text: "Deposit is 30%.", triggers: ["customer_message"], audiences: [], sources: [source] }],
            sources: [source],
        })
        expect(built?.factIds).toEqual(["f1"])
    })

    it("drops an intent the graph does not offer and keeps the first contract of an intent", async () => {
        const subject = await build()

        const built = subject.contractsFromSetup(
            proposal([entry({ intent: "invent_work" }), entry(), entry({ task: "Second." })]),
            FACTS,
            ["reply_customer"],
        )

        expect(built.map((item) => item.business.task)).toEqual(["A booking means a deposit."])
    })

    it("drops a limit that cites no fact the Brain holds, and cites a fact once", async () => {
        const subject = await build()
        const limits = [
            { text: "Invented.", triggers: [], audiences: [], fact_ids: ["nope"] },
            { text: "No source.", triggers: [], audiences: [], fact_ids: [] },
            {
                text: "Inside the city.",
                triggers: [],
                audiences: ["customer" as const],
                fact_ids: ["f2", "f2", "nope"],
            },
        ]

        const [built] = subject.contractsFromSetup(proposal([entry({ limits })]), FACTS, ["reply_customer"])

        expect(built?.business.limits.map((limit) => limit.text)).toEqual(["Inside the city."])
        expect(built?.business.limits[0]?.sources).toHaveLength(1)
        expect(built?.factIds).toEqual(["f1", "f2"])
    })

    it("leaves the task empty when no fact backs it, and drops a contract with neither a task nor a limit", async () => {
        const subject = await build()

        const [limitOnly] = subject.contractsFromSetup(proposal([entry({ task_fact_ids: ["nope"] })]), FACTS, [
            "reply_customer",
        ])
        const nothing = subject.contractsFromSetup(
            proposal([
                entry({
                    task_fact_ids: [],
                    limits: [{ text: "Invented.", triggers: [], audiences: [], fact_ids: [] }],
                }),
            ]),
            FACTS,
            ["reply_customer"],
        )

        expect(limitOnly?.business).toMatchObject({ task: "", sources: [] })
        expect(limitOnly?.business.limits).toHaveLength(1)
        expect(nothing).toEqual([])
    })
})

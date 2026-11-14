import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { FACTS, contextOf, say } from "@tests/fixtures/builders/agent-graph.builder"
import type { SeedModule } from "../agent-graphs-seed.contracts"
import { baseGraphOf } from "./base-graph.policy"
import { graphProblems } from "./graph-problems.policy"

/** The members of the subject under test. */
interface Subject {
    readonly baseGraphOf: typeof baseGraphOf
}

const SUBJECT = Symbol("base-graph.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { baseGraphOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const VOICE = { locale: "en", say } as const

const moduleOf = builder<SeedModule>({
    key: "accounting",
    name: { vi: "Accounting", en: "Accounting" },
    connectionProviders: ["sepay", "unknown"],
})

const keysOf = (graph: ReturnType<typeof baseGraphOf>): ReadonlyArray<string> => graph.nodes.map((node) => node.key)

describe("base-graph.policy", () => {
    it("draws a start, the tag, one understand node and the end, and no data right", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), VOICE)

        expect(keysOf(graph)).toEqual(["start", "tag", "understand", "end"])
        expect(graph.nodes.some((node) => node.decide !== undefined || node.approver !== null)).toBe(false)
        expect("rights" in graph).toBe(false)
    })

    it("leaves no node with a blank answer, no dead end and nothing the owner must fix", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), VOICE)

        expect(graphProblems(graph, contextOf({ facts: FACTS }))).toEqual([])
    })

    it("starts at triggers only: a customer message and the tag of the agent, and every path ends at the end", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), VOICE)

        expect(graph.nodes.filter((node) => node.kind === "trigger").map((node) => [node.key, node.step])).toEqual([
            ["start", "customer_message"],
            ["tag", "tag"],
        ])
        expect(graph.nodes.filter((node) => node.kind === "output").map((node) => node.key)).toEqual(["end"])
        expect(graph.nodes.find((node) => node.key === "understand")).toMatchObject({
            kind: "execute",
            step: "call",
            doneBy: "agent",
            next: ["end"],
        })
    })

    it("lists the providers the module can use on the understand node and ignores the ones it cannot name", async () => {
        const subject = await build()

        const graph = subject.baseGraphOf(moduleOf(), VOICE)

        expect(graph.nodes.find((node) => node.key === "understand")?.uses).toEqual([
            { provider: "sepay", tool: null, scope: "read", label: "sepay" },
        ])
    })
})

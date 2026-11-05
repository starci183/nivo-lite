import { Test } from "@nestjs/testing"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { readGraphSpecs as readGraphSpecsDirect } from "./graph-seed.policy"

const SUBJECT = Symbol("graph-seed.policy")

const subject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readGraphSpecs: readGraphSpecsDirect } }],
    }).compile()
    return moduleRef.get<{ readGraphSpecs: typeof readGraphSpecsDirect }>(SUBJECT)
}

const refused = new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })

const specOf = (moduleKey: string, overrides: Record<string, unknown> = {}) => ({
    schema: "nivo/agent-graph@1",
    moduleKey,
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
    ...overrides,
})
const envelope = (...documents: ReadonlyArray<unknown>): string =>
    `${JSON.stringify({ documents: documents.map((document) => ({ path: "data/graphs/x.json", document })) })}\n`

describe("readGraphSpecs", () => {
    it("reads the graph of each document of the envelope, in order", async () => {
        const { readGraphSpecs } = await subject()
        const specs = readGraphSpecs(envelope(specOf("chatbot"), specOf("sales")))

        expect(specs.map((spec) => spec.moduleKey)).toEqual(["chatbot", "sales"])
    })

    it.each([
        ["text that is not JSON", "{"],
        ["an envelope that is not an object", "[]"],
        ["an envelope with no documents", "{}"],
        ["an entry with no document", JSON.stringify({ documents: [{ path: "x" }] })],
        ["a document that is not a graph spec", envelope({ schema: "nivo/other@1" })],
        ["a document with an unknown key", envelope(specOf("sales", { workspace: "NIVO" }))],
        ["two graphs of one module", envelope(specOf("sales"), specOf("sales"))],
    ])("refuses %s", async (_name, text) => {
        const { readGraphSpecs } = await subject()

        expect(() => readGraphSpecs(text)).toThrow(refused)
    })
})

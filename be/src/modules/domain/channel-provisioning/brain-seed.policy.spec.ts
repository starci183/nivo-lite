import { Test } from "@nestjs/testing"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { readBrainSeeds } from "./brain-seed.policy"
import { BRAIN_SEED_SCHEMA } from "./brain-seed.contracts"

const refused = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const doc = (overrides: Record<string, unknown> = {}) => ({
    title: "Intro",
    topic: "Intro",
    visibility: "public",
    content: "The shop opens at 7:30.",
    ...overrides,
})
const seed = (documents: unknown, overrides: Record<string, unknown> = {}) => ({
    schema: BRAIN_SEED_SCHEMA,
    origin: "seed:tiem-hoa",
    documents,
    ...overrides,
})
const envelope = (...seeds: ReadonlyArray<unknown>): string =>
    `${JSON.stringify({ documents: seeds.map((document) => ({ path: "data/brain.json", document })) })}\n`

const SUBJECT = Symbol("brain-seed.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readBrainSeeds } }],
    }).compile()
    return moduleRef.get<typeof import("./brain-seed.policy")>(SUBJECT)
}

describe("readBrainSeeds", () => {
    let policy: typeof import("./brain-seed.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("reads the documents of every seed, with a null module when none is named", () => {
        const [read] = policy.readBrainSeeds(
            envelope(seed([doc(), doc({ title: "Process", visibility: "internal", module: "chatbot" })])),
        )

        expect(read).toEqual({
            origin: "seed:tiem-hoa",
            documents: [
                {
                    title: "Intro",
                    topic: "Intro",
                    visibility: "public",
                    module: null,
                    content: "The shop opens at 7:30.",
                },
                {
                    title: "Process",
                    topic: "Intro",
                    visibility: "internal",
                    module: "chatbot",
                    content: "The shop opens at 7:30.",
                },
            ],
        })
    })

    it("reads an explicit null module as no module", () => {
        const [read] = policy.readBrainSeeds(envelope(seed([doc({ module: null })])))

        expect(read?.documents[0]?.module).toBeNull()
    })

    it.each([
        ["a wrong schema", envelope(seed([doc()], { schema: "nivo/other@1" })), "schema"],
        ["an origin without the seed: prefix", envelope(seed([doc()], { origin: "tiem-hoa" })), "origin"],
        ["no documents", envelope(seed([])), "documents"],
        ["a title given twice", envelope(seed([doc(), doc()])), "document.title"],
        [
            "a visibility that is neither public nor internal",
            envelope(seed([doc({ visibility: "private" })])),
            "document.visibility",
        ],
        ["an empty content", envelope(seed([doc({ content: "  " })])), "document.content"],
        ["a topic over eighty characters", envelope(seed([doc({ topic: "x".repeat(81) })])), "document.topic"],
        ["an envelope with no documents list", "{}", "input"],
        ["a seed that is not an object", envelope("seed"), "schema"],
        ["a seed whose documents are not a list", envelope(seed("none")), "documents"],
        ["a document that is not an object", envelope(seed(["Intro"])), "document"],
        ["a module that is not a text", envelope(seed([doc({ module: 7 })])), "document.module"],
    ])("refuses %s, by the name of the field", (_name, text, field) => {
        expect(() => policy.readBrainSeeds(text)).toThrow(refused(field))
    })
})

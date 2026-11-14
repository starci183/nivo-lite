import { AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { requireKnownModels } from "./graph-models.policy"

const documentOf = (nodes: ReadonlyArray<Readonly<Record<string, unknown>>>) => ({ nodes: [], flow: { nodes } })

describe("requireKnownModels", () => {
    it("passes a document with no flow, a flow naming no model, and Auto or a model of the vocabulary", () => {
        expect(() => requireKnownModels({ nodes: [] })).not.toThrow()
        expect(() => requireKnownModels(documentOf([{ key: "a", step: "chatbot.understand" }]))).not.toThrow()
        expect(() =>
            requireKnownModels(
                documentOf([
                    { key: "a", step: "chatbot.understand", model: "auto" },
                    { key: "b", step: "webbooks.payment-settle", model: "claude-sonnet-5-5" },
                ]),
            ),
        ).not.toThrow()
    })

    it("refuses every unknown model and every model on a node that calls no AI, naming them all", () => {
        expect(() =>
            requireKnownModels(
                documentOf([
                    { key: "a", step: "chatbot.understand", model: "gpt-9" },
                    { key: "b", step: "core.if", model: "auto" },
                    { key: "c", step: "chatbot.answer", model: 7 },
                ]),
            ),
        ).toThrow(
            expect.objectContaining({
                code: AgentGraphsErrorCode.ModelRefused,
                params: expect.objectContaining({ count: "3", first: "a" }),
            }),
        )
    })
})

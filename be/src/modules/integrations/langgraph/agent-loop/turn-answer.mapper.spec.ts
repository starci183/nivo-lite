import { AIMessage } from "@langchain/core/messages"
import { Test } from "@nestjs/testing"
import { answerOf, messageOf } from "./turn-answer.mapper"

/** The members of the subject under test. */
interface Subject {
    readonly answerOf: typeof answerOf
    readonly messageOf: typeof messageOf
}

const SUBJECT = Symbol("turn-answer.mapper")

/** The mapper functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: { answerOf, messageOf } }] }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("turn-answer.mapper", () => {
    it("keeps the words and the calls as plain data, well-formed ones first, and names a call the provider gave no id by its place", async () => {
        const mapper = await build()
        const message = new AIMessage({
            content: "thinking",
            tool_calls: [
                { type: "tool_call", id: "p-1", name: "order.read", args: { id: "o-1" } },
                { type: "tool_call", name: "order.void", args: {} },
            ],
            invalid_tool_calls: [{ type: "invalid_tool_call", id: "p-3", name: "order.create", args: "{oops", error: "x" }],
        })

        const answer = mapper.answerOf(message, 3)

        expect(answer).toEqual({
            text: "thinking",
            calls: [
                { id: "p-1", name: "order.read", args: { id: "o-1" } },
                { id: "turn-3-call-2", name: "order.void", args: {} },
                { id: "p-3", name: "order.create", args: "{oops" },
            ],
        })
        // Plain data: what a record of the turn keeps comes back equal.
        expect(structuredClone(answer)).toEqual(answer)
        expect(JSON.stringify(structuredClone(answer))).toBe(JSON.stringify(answer))
    })

    it("builds the same message from an answer and from its stored copy: words and calls only, unreadable arguments shown empty", async () => {
        const mapper = await build()
        const answer = mapper.answerOf(
            new AIMessage({
                content: "",
                tool_calls: [{ type: "tool_call", id: "p-1", name: "order.read", args: { id: "o-1" } }],
                invalid_tool_calls: [{ type: "invalid_tool_call", id: "p-2", name: "order.create", args: "{oops", error: "x" }],
                additional_kwargs: { reasoning: "hidden" },
            }),
            1,
        )

        const live = mapper.messageOf(answer)
        const replayed = mapper.messageOf(structuredClone(answer))

        expect(live.tool_calls).toEqual([
            { type: "tool_call", id: "p-1", name: "order.read", args: { id: "o-1" } },
            { type: "tool_call", id: "p-2", name: "order.create", args: {} },
        ])
        expect(replayed.tool_calls).toEqual(live.tool_calls)
        expect(replayed.content).toBe(live.content)
        expect(live.additional_kwargs).toEqual({})
        expect(live.invalid_tool_calls).toEqual([])
    })
})

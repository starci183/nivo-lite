import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { providerOf } from "../accounting.doubles"
import type { QuestionList } from "../accounting.types"
import { questionListPort } from "../ports"
import { answerQuestionAction } from "./answer-question.action"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

const harness = (open: boolean) => {
    const answers: Array<readonly [string, string, string]> = []
    const list: QuestionList = {
        waiting: () => Promise.resolve([]),
        answer: (id, text, member) => {
            answers.push([id, text, member])
            return Promise.resolve({ ok: open })
        },
    }
    const run = (raw: unknown, context: RunContext = CONTEXT) =>
        answerQuestionAction.execute?.(providerOf([[questionListPort, list]]), raw, context)
    return { answers, run }
}

describe("accounting.answer-question", () => {
    it("records the trimmed answer by the member", async () => {
        const { answers, run } = harness(true)
        await expect(run({ id: "q1", command: "edit", values: { answer: "  HD-0139  " } })).resolves.toEqual({
            ok: true,
        })
        expect(answers).toEqual([["q1", "HD-0139", "m1"]])
    })

    it("credits the system when no member answered", async () => {
        const { answers, run } = harness(true)
        await run({ id: "q1", command: "edit", values: { answer: "x" } }, { ...CONTEXT, memberId: null })
        expect(answers[0]?.[2]).toBe("system")
    })

    it("refuses an empty answer naming the field", async () => {
        const { answers, run } = harness(true)
        await expect(run({ id: "q1", command: "edit", values: { answer: "  " } })).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
            fields: { answer: { key: "answer_empty" } },
        })
        expect(answers).toEqual([])
    })

    it("refuses a question that is gone or already answered", async () => {
        const { run } = harness(false)
        await expect(run({ id: "q1", command: "edit", values: { answer: "x" } })).resolves.toMatchObject({
            ok: false,
            reason: "refused",
        })
    })

    it("is a transactional action of the manage permission that refreshes the questions", () => {
        expect(answerQuestionAction).toMatchObject({ permission: "accounting.manage", transactional: true })
        expect(answerQuestionAction.refreshes).toEqual(["accounting.questions", "accounting.question-count"])
    })
})

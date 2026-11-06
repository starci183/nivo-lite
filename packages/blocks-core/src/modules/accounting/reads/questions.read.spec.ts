import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { providerOf, questionCounter } from "../accounting.doubles"
import type { QuestionList } from "../accounting.types"
import { questionListPort, questionsPort } from "../ports"
import { QUESTIONS_SHOWN, questionCountRead, questionsRead } from "./questions.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

const ASKED = { id: "q1", text: "Which invoice?", source: "HD-0139", askedAt: "2026-11-04T02:12:00.000Z" }

const run = (waiting: number) => {
    const limits: Array<number> = []
    const list: QuestionList = {
        waiting: (limit) => {
            limits.push(limit)
            return Promise.resolve(waiting === 0 ? [] : [ASKED])
        },
        answer: () => Promise.resolve({ ok: true }),
    }
    const provider = providerOf([
        [questionsPort, questionCounter({ waiting: () => Promise.resolve(waiting) })],
        [questionListPort, list],
    ])
    return {
        limits,
        count: questionCountRead.execute?.(provider, {}, CONTEXT),
        queue: questionsRead.execute?.(provider, {}, CONTEXT),
    }
}

describe("the accounting question reads", () => {
    it("count the questions that wait for the owner", async () => {
        await expect(run(3).count).resolves.toEqual({ ok: true, data: { count: 3 } })
    })

    it("list the questions as a queue with the answer form on each, and count all of them", async () => {
        const { limits, queue } = run(3)
        await expect(queue).resolves.toMatchObject({
            ok: true,
            data: { count: "3", rows: [{ id: "q1", description: "HD-0139", edit: { id: "edit" } }] },
        })
        expect(limits).toEqual([QUESTIONS_SHOWN])
    })

    it("have no count on the queue when nothing waits", async () => {
        await expect(run(0).queue).resolves.toMatchObject({ ok: true, data: { count: null, rows: [] } })
    })

    it("are read with the view permission", () => {
        expect(questionCountRead.permission).toBe("accounting.view")
        expect(questionsRead.permission).toBe("accounting.view")
    })
})

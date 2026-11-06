import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { providerOf, questionCounter } from "../accounting.doubles"
import { questionsPort } from "../ports"
import { questionCountRead, questionsRead } from "./questions.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

const run = (waiting: number) => {
    const provider = providerOf([[questionsPort, questionCounter({ waiting: () => Promise.resolve(waiting) })]])
    return {
        count: questionCountRead.execute?.(provider, {}, CONTEXT),
        region: questionsRead.execute?.(provider, {}, CONTEXT),
    }
}

describe("the accounting question reads", () => {
    it("count the questions that wait for the owner", async () => {
        const { count, region } = run(3)
        await expect(count).resolves.toEqual({ ok: true, data: { count: 3 } })
        await expect(region).resolves.toEqual({
            ok: true,
            data: { count: "3", rows: [], linkLabel: "", linkHref: "", more: null },
        })
    })

    it("have no count on the region when nothing waits", async () => {
        await expect(run(0).region).resolves.toMatchObject({ ok: true, data: { count: null } })
    })

    it("are read with the view permission", () => {
        expect(questionCountRead.permission).toBe("accounting.view")
        expect(questionsRead.permission).toBe("accounting.view")
    })
})

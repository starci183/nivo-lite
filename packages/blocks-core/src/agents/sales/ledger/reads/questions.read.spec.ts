import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import { ACCOUNTANT_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"

const run = (read: ReadDefinition, world: MemoryWorld, raw: unknown = {}): Promise<ReadRunResult> =>
    read.execute?.(memoryProvider(world), raw, ACCOUNTANT_CONTEXT) ?? Promise.resolve({ ok: false, problems: [] })
import { putQuestion } from "../fixtures/accounting.memory"
import { QUESTIONS_SHOWN, questionCountRead, questionsRead } from "./questions.read"

const ASKED = "2026-11-04T02:12:00.000Z"

describe("the accounting question reads", () => {
    it("count the questions that wait for the owner, not the answered ones", async () => {
        const world = memoryWorld()
        putQuestion(world, "q1", { text: "Which invoice?", source: "HD-0139" }, ASKED)
        putQuestion(world, "q2", { text: "Done", source: null, status: "answered" }, ASKED)
        await expect(run(questionCountRead, world)).resolves.toEqual({ ok: true, data: { count: 1 } })
    })

    it("list the waiting questions oldest first as a queue with the answer form on each", async () => {
        const world = memoryWorld()
        putQuestion(world, "q2", { text: "Second", source: null }, "2026-11-04T03:00:00.000Z")
        putQuestion(world, "q1", { text: "First", source: "HD-0139" }, ASKED)
        await expect(run(questionsRead, world)).resolves.toMatchObject({
            ok: true,
            data: {
                count: "2",
                rows: [
                    { id: "q1", title: "First", description: "HD-0139", edit: { id: "edit" }, askedAt: ASKED },
                    { id: "q2", title: "Second", description: "" },
                ],
            },
        })
    })

    it("have no count on the queue when nothing waits", async () => {
        await expect(run(questionsRead, memoryWorld())).resolves.toMatchObject({
            ok: true,
            data: { count: null, rows: [] },
        })
    })

    it("are read with the view permission and list at most twenty", () => {
        expect(questionCountRead.permission).toBe("sales.view")
        expect(questionsRead.permission).toBe("sales.view")
        expect(QUESTIONS_SHOWN).toBe(20)
    })
})

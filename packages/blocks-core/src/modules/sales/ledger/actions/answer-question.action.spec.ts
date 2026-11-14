import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import {
    ACCOUNTANT_CONTEXT,
    ACCOUNTANT_ID,
    SYSTEM_CONTEXT,
    memoryProvider,
    memoryWorld,
    putQuestion,
    rowsOf,
} from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { answerQuestionAction } from "./answer-question.action"

const ASKED = "2026-11-04T02:12:00.000Z"

const worldOf = (status = "open"): MemoryWorld => {
    const world = memoryWorld()
    putQuestion(world, "q1", { text: "Which invoice?", source: "HD-0139", status }, ASKED)
    return world
}

const run = (world: MemoryWorld, raw: unknown, context = ACCOUNTANT_CONTEXT): Promise<ActionResult> =>
    answerQuestionAction.execute?.(memoryProvider(world), raw, context) ?? Promise.reject(new Error("not runnable"))

const payload = (answer: string) => ({ id: "q1", command: "edit", answer })

describe("sales.answer-question", () => {
    it("records the trimmed answer by the member and closes the question", async () => {
        const world = worldOf()
        await expect(run(world, payload("  HD-0139  "))).resolves.toEqual({ ok: true })
        expect(rowsOf(world, "blocks-core.sales.ledger-question")[0]?.data).toMatchObject({
            status: "answered",
            answer: "HD-0139",
            answeredBy: "Lan",
        })
        expect(ACCOUNTANT_ID).toBeTruthy()
    })

    it("credits the system when no member answered", async () => {
        const world = worldOf()
        await run(world, payload("x"), SYSTEM_CONTEXT)
        expect(rowsOf(world, "blocks-core.sales.ledger-question")[0]?.data["answeredBy"]).toBe("system")
    })

    it("refuses an empty answer naming the field", async () => {
        const world = worldOf()
        await expect(run(world, payload("  "))).resolves.toMatchObject({
            ok: false,
            reason: "invalid",
            fields: { answer: { key: "answer_empty" } },
        })
        expect(rowsOf(world, "blocks-core.sales.ledger-question")[0]?.data["status"]).toBe("open")
    })

    it("refuses a question that is gone or already answered", async () => {
        await expect(run(memoryWorld(), payload("x"))).resolves.toMatchObject({ ok: false, reason: "refused" })
        await expect(run(worldOf("answered"), payload("x"))).resolves.toMatchObject({ ok: false, reason: "refused" })
    })

    it("is a transactional action of the manage permission that refreshes the questions", () => {
        expect(answerQuestionAction).toMatchObject({ permission: "sales.manage", transactional: true })
        expect(answerQuestionAction.refreshes).toEqual(["blocks-core.sales.api.question.list", "blocks-core.sales.api.question.count"])
    })
})

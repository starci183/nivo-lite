import { TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import type { FailReason, NodeContext } from "@nivo-lite/agent-sdk/template"
import type { z } from "zod"
import { answered, contextAnswer } from "../../../shared/nodes/tool-answers"
import { chatbotUnderstandNode } from "./understand.node"

// Defect seen on dev (P-NEXT item 3): a shop with NO booking agent installed had a "book an appointment" line routed `book`, and the
// hand-off `to-booking` failed `AGENTS_TAG_TARGET_MISSING` (a stop card). Rule: the front desk offers its model only the routes whose
// hand-off target exists in this installation; the engine names the others (`run.unreachable`), never a hard-coded agent list in the node.

/** What the stand-in model was asked: the goal and the answer schema. */
interface Asked {
    readonly goal: string
    readonly output: z.ZodType
}

const contextOf = (unreachable: ReadonlyArray<string> | undefined) => {
    const asked: Array<Asked> = []
    const answers: Partial<Record<ToolId, unknown>> = {
        [TOOL.conversationMessageList]: answered({ facts: [] }),
        [TOOL.leadOrderList]: contextAnswer("nivo.lead", []),
    }
    const context = {
        params: {},
        run: {
            id: "run-1",
            at: "2026-11-14T08:00:00.000Z",
            day: "2026-11-14",
            item: null,
            queue: [],
            waiting: 0,
            ...(unreachable === undefined ? {} : { unreachable }),
        },
        subject: null,
        policy: {},
        workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Shop" },
        tools: { call: (id: ToolId) => Promise.resolve(answers[id]) },
        agent: {
            run: (request: Asked) => {
                asked.push(request)
                return Promise.resolve({ branch: "question", summary: "Khách muốn đặt lịch" })
            },
        },
        fail: (reason: FailReason): never => {
            throw new Error(JSON.stringify(reason))
        },
    } as unknown as NodeContext
    return { context, asked }
}

describe("chatbot.understand offers only the routes this installation can follow", () => {
    it("with `book` unreachable, the model's answer schema refuses book and the goal never names it; question stays", async () => {
        const { context, asked } = contextOf(["book"])
        const output = await chatbotUnderstandNode.run({ text: "Cho mình đặt lịch chiều mai" }, context)
        const [request] = asked
        expect(request?.output.safeParse({ branch: "book", summary: "x" }).success).toBe(false)
        expect(request?.output.safeParse({ branch: "question", summary: "x" }).success).toBe(true)
        expect(request?.output.safeParse({ branch: "buy", summary: "x" }).success).toBe(true)
        expect(request?.goal).not.toContain('"book"')
        expect(request?.goal).toContain("These are the only routes this shop has")
        expect(output.branch).toBe("question")
    })

    it("with every route reachable (or the engine naming none), the five routes are offered as before", async () => {
        for (const unreachable of [undefined, []]) {
            const { context, asked } = contextOf(unreachable)
            await chatbotUnderstandNode.run({ text: "Cho mình đặt lịch chiều mai" }, context)
            const [request] = asked
            for (const branch of ["buy", "book", "paid", "complaint", "question"])
                expect(request?.output.safeParse({ branch, summary: "x" }).success).toBe(true)
            expect(request?.goal).toContain('"book"')
            expect(request?.goal).not.toContain("These are the only routes this shop has")
        }
    })

    it("question is never closed: an engine naming it unreachable still leaves the front desk its own answer", async () => {
        const { context, asked } = contextOf(["question", "book", "paid"])
        await chatbotUnderstandNode.run({ text: "Shop mở cửa mấy giờ" }, context)
        expect(asked[0]?.output.safeParse({ branch: "question", summary: "x" }).success).toBe(true)
        expect(asked[0]?.output.safeParse({ branch: "paid", summary: "x" }).success).toBe(false)
    })
})

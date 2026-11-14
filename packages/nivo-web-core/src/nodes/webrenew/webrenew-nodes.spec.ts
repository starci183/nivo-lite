import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { webrenewNodes } from "./webrenew-nodes"

/** The Renewal steps of this slice: every node of the module but the chat turn, which `team-answer.spec.ts` checks with its siblings. */
const STEPS: ReadonlyArray<AnyTemplateNode> = webrenewNodes.filter((node) => node.id !== "webrenew.team-answer")

describe("the steps of the Renewal agent (webrenew)", () => {
    it.each(STEPS.map((node) => [node.id, node] as const))(
        "%s conforms: its definition and every example hold",
        async (_id, node) => {
            expect(await checkTemplateNode(node)).toEqual([])
        },
    )

    it("list every step once, the chat turn last", () => {
        const ids = webrenewNodes.map((node) => node.id)
        expect(new Set(ids).size).toBe(ids.length)
        // 22 since the one-run answer talk (R53): + `webrenew.round-message`, the message of a round of the talk.
        expect(ids).toHaveLength(22)
        expect(ids.every((id) => id.startsWith("webrenew."))).toBe(true)
        expect(ids.at(-1)).toBe("webrenew.team-answer")
    })
})

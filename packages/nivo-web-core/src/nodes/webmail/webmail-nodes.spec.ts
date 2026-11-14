import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { webmailNodes } from "./webmail-nodes"

describe("the steps of the Mailbox agent", () => {
    it.each(webmailNodes.map((node) => [node.id, node] as const))(
        "%s conforms: its definition and every example hold",
        async (_id, node) => {
            expect(await checkTemplateNode(node)).toEqual([])
        },
    )

    it("lists the three steps; only the mail fetch makes no AI call", () => {
        expect(webmailNodes.map((node) => [node.id, node.model ?? null])).toEqual([
            ["webmail.read", null],
            ["webmail.sort", "claude-sonnet-5-5"],
            ["webmail.sorted-report", "claude-sonnet-5-5"],
        ])
    })
})

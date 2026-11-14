import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { webdocsNodes } from "./webdocs-nodes"

describe("the steps of the Paperwork agent", () => {
    it.each(webdocsNodes.map((node) => [node.id, node] as const))(
        "%s conforms: its definition and every example hold",
        async (_id, node) => {
            expect(await checkTemplateNode(node)).toEqual([])
        },
    )

    it("lists the three steps; only the team post makes no AI call", () => {
        expect(webdocsNodes.map((node) => [node.id, node.model ?? null])).toEqual([
            ["webdocs.read", "claude-sonnet-5-5"],
            ["webdocs.draft", "claude-sonnet-5-5"],
            ["webdocs.draft-post", null],
        ])
    })
})

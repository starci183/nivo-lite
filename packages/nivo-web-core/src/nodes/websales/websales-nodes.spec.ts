import { checkTemplateNode } from "@nivo-lite/agent-sdk/template"
import { websalesNodes } from "./websales-nodes"

describe("the Sales template nodes", () => {
    it("lists every step of the module once, by its id", () => {
        const ids = websalesNodes.map((node) => node.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => id.startsWith("websales."))).toBe(true)
    })

    it.each(websalesNodes.map((node) => [node.id, node] as const))(
        "%s conforms and its examples hold",
        async (_id, node) => {
            expect(await checkTemplateNode(node)).toEqual([])
        },
    )
})

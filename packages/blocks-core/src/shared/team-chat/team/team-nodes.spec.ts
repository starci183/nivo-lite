import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { teamAnswerPostNode } from "./answer-post.node"
import { teamChatNode } from "./team-chat.node"
import { teamTruthProposeNode } from "./truth-propose.node"

/** The three team-chat nodes: each definition is clean and every worked example holds against the SDK's example runner. */
describe("team template nodes", () => {
    it.each([
        ["team.chat", teamChatNode],
        ["team.truth-propose", teamTruthProposeNode],
        ["team.answer-post", teamAnswerPostNode],
    ])("%s conforms", async (id, node) => {
        expect(node.id).toBe(id)
        expect(await checkTemplateNode(node)).toEqual([])
    })

    it("only the chat turn calls the AI: the propose and post steps name no model", () => {
        expect(teamChatNode.model).toBe("claude-sonnet-5-5")
        expect(teamTruthProposeNode.model).toBeUndefined()
        expect(teamAnswerPostNode.model).toBeUndefined()
    })
})

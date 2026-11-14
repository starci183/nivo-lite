import { TOOL } from "@nivo-lite/agent-sdk/names"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { chatbotAnswerNode } from "./answer.node"
import { chatbotComplaintNotifyNode } from "./complaint-notify.node"
import { chatbotComplaintReplyNode } from "./complaint-reply.node"
import { chatbotHearNode } from "./hear.node"
import { chatbotUnderstandNode } from "./understand.node"

/** The five front-desk nodes: each definition is clean and every worked example holds against the SDK's example runner. */
describe("chatbot template nodes", () => {
    it.each([
        ["chatbot.hear", chatbotHearNode],
        ["chatbot.understand", chatbotUnderstandNode],
        ["chatbot.answer", chatbotAnswerNode],
        ["chatbot.complaint-reply", chatbotComplaintReplyNode],
        ["chatbot.complaint-notify", chatbotComplaintNotifyNode],
    ])("%s conforms", async (id, node) => {
        expect(node.id).toBe(id)
        expect(await checkTemplateNode(node)).toEqual([])
    })

    // Design moved (ruling R43): no `held` route: a staff hold is the engine's route hold, refused at its send door (`route_held`).
    // Design change (ruling R45): a fresh visit goes on (`go`, no words), so there is no `fresh-visit` route.
    it("hear routes by its route: answer, nothing to answer", () => {
        expect(chatbotHearNode.routes).toEqual({ by: "route", names: ["go", "nothing"] })
        // Since R26 a resume reads the person's unanswered lines from the engine's conversation (no chatbot message records).
        expect(chatbotHearNode.tools).toEqual([TOOL.conversationMessageList])
        expect(chatbotHearNode.model).toBeUndefined()
    })

    it("understand routes by its branch, five ways", () => {
        expect(chatbotUnderstandNode.routes).toEqual({ by: "branch", names: ["buy", "book", "paid", "complaint", "question"] })
    })

    it("the complaint notice is a side step; the replies block", () => {
        expect(chatbotComplaintNotifyNode.blocking).toBe(false)
        expect(chatbotComplaintReplyNode.blocking).toBeUndefined()
        expect(chatbotAnswerNode.blocking).toBeUndefined()
    })
})

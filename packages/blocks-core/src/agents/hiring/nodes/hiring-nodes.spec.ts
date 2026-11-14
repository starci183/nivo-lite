import { TOOL } from "@nivo-lite/agent-sdk/names"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { hiringDigestNode } from "./digest.node"
import { DIGEST_GOAL, INVITE_GOAL, PROTECTED_TRAITS, SCREEN_GOAL } from "./hiring.policy"
import { hiringInviteNode } from "./invite.node"
import { hiringNotifyNode } from "./notify.node"
import { hiringScreenNode } from "./screen.node"

const NODES = [hiringScreenNode, hiringNotifyNode, hiringInviteNode, hiringDigestNode] as const

/** The four hiring nodes: each definition is clean and every worked example holds against the SDK's example runner. */
describe("hiring template nodes", () => {
    it.each(NODES.map((node) => [node.id, node] as const))("%s conforms", async (_id, node) => {
        expect(await checkTemplateNode(node)).toEqual([])
    })

    it("asks a person before the invitation goes, through a sending mailbox; the rest runs on NIVO's own tools", () => {
        expect(hiringInviteNode.mode).toBe("ask")
        expect(hiringInviteNode.accounts).toEqual(["smtp"])
        expect(hiringInviteNode.tools).toContain(TOOL.mailMessageSend)
        for (const node of [hiringScreenNode, hiringNotifyNode, hiringDigestNode]) {
            expect(node.mode).toBe("auto")
            expect(node.accounts).toEqual([])
        }
    })

    it("keeps the notice and the invitation as side steps; the screening and the digest block", () => {
        expect(hiringNotifyNode.blocking).toBe(false)
        expect(hiringInviteNode.blocking).toBe(false)
        expect(hiringScreenNode.blocking).toBeUndefined()
        expect(hiringDigestNode.blocking).toBeUndefined()
    })

    it("carries the fairness rule into every goal the model reads", () => {
        for (const goal of [SCREEN_GOAL, INVITE_GOAL, DIGEST_GOAL]) expect(goal).toContain(PROTECTED_TRAITS)
        expect(SCREEN_GOAL).toContain("Do not decide to hire or reject")
    })
})

import { TOOL } from "@nivo-lite/agent-sdk/names"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { teamDeclinedNoticeNode } from "./declined-notice.node"

/** The shared notice of a graph's `declined` branch: clean, no AI, one team post, never blocking. */
describe("team.declined-notice", () => {
    it("conforms: every worked example holds against the SDK's example runner", async () => {
        expect(teamDeclinedNoticeNode.id).toBe("team.declined-notice")
        expect(await checkTemplateNode(teamDeclinedNoticeNode)).toEqual([])
    })

    it("posts one team message, its mode stated auto under nivo (decision #5), calls no AI and never stops the run", () => {
        expect(teamDeclinedNoticeNode.tools).toEqual([TOOL.teamMessagePost])
        // `nivo-frame.rights`: NIVO's own tool, through no provider; the node declares `auto`.
        expect(teamDeclinedNoticeNode.accounts).toEqual([])
        expect(teamDeclinedNoticeNode.mode).toBe("auto")
        expect(teamDeclinedNoticeNode.model).toBeUndefined()
        expect(teamDeclinedNoticeNode.blocking).toBe(false)
    })
})

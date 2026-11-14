import { PROVIDER, TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"
import { chatbotComplaintNotifyNode } from "../../agents/chatbot/nodes/complaint-notify.node"
import { salesCareDeliveryWaitNode } from "../../agents/sales/nodes/care-delivery-wait.node"
import { salesCareOccasionRearmNode } from "../../agents/sales/nodes/care-occasion-rearm.node"
import { salesCareOccasionWaitNode } from "../../agents/sales/nodes/care-occasion-wait.node"
import { salesCarePlanDeliveryNode } from "../../agents/sales/nodes/care-plan-delivery.node"
import { salesCarePlanOccasionsNode } from "../../agents/sales/nodes/care-plan-occasions.node"
import { salesConsultStageNode } from "../../agents/sales/nodes/consult-stage.node"
import { salesConsultTurnNode } from "../../agents/sales/nodes/consult-turn.node"
import { salesOccasionKeepNode } from "../../agents/sales/nodes/occasion-keep.node"
import { salesOrderCancelNode } from "../../agents/sales/nodes/order-cancel.node"
import { salesWebOrderKeepNode } from "../../agents/sales/nodes/web-order-keep.node"
import { salesWebOrderLeadNode } from "../../agents/sales/nodes/web-order-lead.node"
import { salesWebOrderNoticeNode } from "../../agents/sales/nodes/web-order-notice.node"
import { teamAnswerPostNode } from "../team-chat/team/answer-post.node"
import { teamDeclinedNoticeNode } from "../team-chat/team/declined-notice.node"
import { teamTruthProposeNode } from "../team-chat/team/truth-propose.node"

// `nivo-frame.rights` (owner 2026-11-13, superseding decision #5 of `flipDecisions2026_11_13`): every node DECLARES one mode; a plain
// write of NIVO's own records is `auto`; the cancel is `auto` too (the graph cancels only an unpaid order). NIVO itself is never listed as a provider. A record tool is
// DEFAULT for every node, and so is a timer (`nivo.tool.timer.arm`, the care steps' arm) (`null` below: never listed in `tools`), so those
// rows judge the mode alone.

const STATED: ReadonlyArray<readonly [AnyTemplateNode, ToolId | null, "auto" | "ask"]> = [
    [chatbotComplaintNotifyNode, TOOL.teamMessagePost, "auto"],
    [teamAnswerPostNode, TOOL.teamMessagePost, "auto"],
    [salesWebOrderNoticeNode, TOOL.teamMessagePost, "auto"],
    [teamDeclinedNoticeNode, TOOL.teamMessagePost, "auto"],
    [teamTruthProposeNode, TOOL.brainChangePropose, "auto"],
    [salesOccasionKeepNode, TOOL.contactMemoryRemember, "auto"],
    [salesConsultStageNode, null, "auto"],
    [salesWebOrderLeadNode, null, "auto"],
    [salesWebOrderKeepNode, null, "auto"],
    [salesCarePlanDeliveryNode, null, "auto"],
    [salesCarePlanOccasionsNode, null, "auto"],
    [salesCareDeliveryWaitNode, null, "auto"],
    [salesCareOccasionWaitNode, null, "auto"],
    [salesCareOccasionRearmNode, null, "auto"],
    [salesConsultTurnNode, TOOL.customerMessageSend, "auto"],
    [salesOrderCancelNode, null, "auto"],
]

describe("the declared modes of blocks-core's writes (nivo-frame.rights)", () => {
    it.each(STATED.map(([node, tool, mode]) => [node.id, tool, mode, node] as const))(
        "%s lists %s and declares %s, with NIVO never listed as a provider",
        (_id, tool, mode, node) => {
            if (tool === null) expect(node.tools).toEqual(expect.not.arrayContaining([TOOL.recordUpdate, TOOL.timerArm]))
            else expect(node.tools).toContain(tool)
            expect(node.mode).toBe(mode)
            expect(node.accounts).not.toContain(PROVIDER.nivo)
        },
    )

    it("the consult turn keeps its customer send: its messaging providers, in order", () => {
        expect(salesConsultTurnNode.tools).toEqual(expect.arrayContaining([TOOL.customerMessageSend]))
        expect(salesConsultTurnNode.accounts).toEqual([PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta])
    })
})

import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { messageOf } from "../../../shared/messages/catalog"
import { hiringInviteMoveNode } from "../nodes/invite-move.node"
import { hiringInviteNode } from "../nodes/invite.node"
import { hiringNotifyNode } from "../nodes/notify.node"
import { hiringScreenNode } from "../nodes/screen.node"
import { teamDeclinedNoticeNode } from "../../../shared/team-chat/team/declined-notice.node"

/** The key of the screening workflow. */
export const HIRING_SCREEN_GRAPH_KEY = "hiring.screen"

/** The name of the workflow, as the market and the workflow list show it. */
const SCREEN_NAME = { vi: "S\u00e0ng l\u1ecdc \u1ee9ng vi\u00ean", en: "Screen a candidate" }

/**
 * `hiring.screen` version 3 (Sang loc ung vien): called with a candidate (`candidateId`, a `blocks-core.hiring.candidate` record) from the
 * workbench or from /chat. The screening compares the candidate with the job's written requirements under the fairness rule and
 * moves them to `screened` (`screen`), the team reads the summary (`notify`, a side step), then the interview invitation is drafted
 * for a person to approve (`invite`, mode `ask`, its one write the mail; a side step with no sending mailbox) and, once mailed
 * (`mailed`, an exact boolean), the candidate moves to `interview` (`move`). Nothing rejects a candidate: a person decides. A declined
 * invitation or a declined move is told to the team (`team.declined-notice`) and ends `declined`.
 * Change from version 2: `hiring.invite` (one `ask` step that mailed AND moved the record: two writes under one approval) is split into
 * `invite` (the mail) and `move` (the record), one write each (rights rule 11e), same order; a declined invitation now ends `declined`
 * (it was passed over). Change from version 1: `screen` declined (the screening was not stored) and `invite` declined (the candidate was mailed but not moved to `interview`) -> the team is told, outcome `declined`.
 */
export const hiringScreenGraph: TemplateGraph = defineTemplateGraph({
    key: HIRING_SCREEN_GRAPH_KEY,
    title: SCREEN_NAME,
    input: z.object({ data: z.object({ candidateId: z.string().min(1).max(MAX_ID) }) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "screen",
    nodes: {
        screen: node(hiringScreenNode, {
            input: { candidateId: ref("trigger.data.candidateId") },
            next: "screen-declined",
        }),
        "screen-declined": ifNode({
            when: equals(ref("steps.screen.output.declined"), true),
            yes: "screen-declined-notice",
            no: "notify",
        }),
        "screen-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf("vi", "nodeHiringScreenTitle"), ref: ref("trigger.data.candidateId") },
            next: "declined",
        }),
        notify: node(hiringNotifyNode, {
            input: { title: messageOf("vi", "hiringScreenedLine"), text: ref("steps.screen.output.summary") },
            next: "invite",
        }),
        invite: node(hiringInviteNode, {
            input: { candidateId: ref("trigger.data.candidateId"), summary: ref("steps.screen.output.summary") },
            next: "invite-declined",
        }),
        // A person declined the invitation: nothing was mailed; the team is told, the run ends `declined`.
        "invite-declined": ifNode({
            when: equals(ref("steps.invite.output.declined"), true),
            yes: "invite-declined-notice",
            no: "mailed",
        }),
        "invite-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf("vi", "nodeHiringInviteTitle"), ref: ref("trigger.data.candidateId") },
            next: "declined",
        }),
        // Mailed (an exact boolean): the candidate moves to interview; no mail (no address, no mailbox, a refused send): screened.
        mailed: ifNode({ when: equals(ref("steps.invite.output.mailed"), true), yes: "move", no: "screened" }),
        move: node(hiringInviteMoveNode, {
            input: { candidateId: ref("trigger.data.candidateId") },
            next: "move-declined",
        }),
        // The candidate was mailed but a person declined moving the record: the team is told, the run ends `declined`.
        "move-declined": ifNode({
            when: equals(ref("steps.move.output.declined"), true),
            yes: "move-declined-notice",
            no: "screened",
        }),
        "move-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf("vi", "nodeHiringInviteMoveTitle"), ref: ref("trigger.data.candidateId") },
            next: "declined",
        }),
        screened: outcome({ name: "screened", output: { candidateId: ref("trigger.data.candidateId") } }),
        declined: outcome({ name: "declined", output: { candidateId: ref("trigger.data.candidateId") } }),
    },
    catalogue: {
        name: SCREEN_NAME,
        summary: {
            vi: "\u0110\u1ed1i chi\u1ebfu \u1ee9ng vi\u00ean v\u1edbi y\u00eau c\u1ea7u c\u00f4ng vi\u1ec7c v\u00e0 m\u1eddi ph\u1ecfng v\u1ea5n khi ng\u01b0\u1eddi duy\u1ec7t \u0111\u1ed3ng \u00fd",
            en: "Compares a candidate with the job's requirements and invites them once a person approves",
        },
        version: 4,
        publishedAt: "2026-11-14T04:15:00.000Z",
        notes: {
            vi: "Nh\u1eadn tham s\u1ed1 c\u1ee7a b\u01b0\u1edbc g\u1ecdi trong d\u1eef li\u1ec7u c\u1ee7a s\u1ef1 ki\u1ec7n (trigger.data)",
            en: "Takes its caller's params in the event's data (trigger.data)",
        },
        seedActive: true,
    },
})

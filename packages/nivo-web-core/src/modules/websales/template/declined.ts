import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import {
    type IfGraphStep,
    type NodeGraphStep,
    type OutcomeGraphStep,
    type Ref,
    equals,
    ifNode,
    node,
    outcome,
    ref,
} from "@nivo-lite/agent-sdk/template"
import { type WebsalesCopyKey, websalesCopy } from "../copy"

/**
 * The declined wiring of the Sales graphs (NODES-LEAD's `declined` rule, 2026-11-12): a person who declines an approval (a shop that set a step to `ask` on its copy; NIVO Web's own steps run `auto`) made a
 * DECISION. A blocking `ask` node returns `declined: true`; the graph checks it with an `ifNode` right after the node, posts ONE team
 * notice (blocks-core's `team.declined-notice`: no AI, catalogue text) and ends at the outcome `declined`. Inside a loop body the notice
 * has no `next`: the declined item ends there and the loop goes on.
 */

/** The language the team reads (every Sales graph's constant). */
const LOCALE = "vi"

/** The key and the name of the outcome every declined branch of a Sales graph ends at. */
export const DECLINED_END = "declined"

/** The outcome a declined branch ends at (outside a loop body). */
export const declinedEnd = (): OutcomeGraphStep => outcome({ name: DECLINED_END })

/**
 * The exact check after a blocking `ask` step (`steps.<step>.output.declined` is true): the notice when it holds, `otherwise` when it
 * does not (absent: the run ends there, or, in a loop body, the item ends).
 */
export const declinedCheck = (step: string, notice: string, otherwise?: string): IfGraphStep =>
    ifNode({ when: equals(ref(`steps.${step}.output.declined`), true), yes: notice, no: otherwise })

/**
 * The team's notice of a declined step: `step` is the declined node's catalogue title in the team's language (a literal, so the notice
 * names the very step), `record` the code of the record it was about (null when none was made). `next` is the declined outcome outside a
 * loop body (`scope: "run"`: the workflow stopped); absent inside one (`scope: "item"`: only this item ends, the loop goes on).
 */
export const declinedNotice = (
    title: WebsalesCopyKey,
    record: Ref<string | null> | null,
    next?: string,
): NodeGraphStep =>
    node(teamDeclinedNoticeNode, {
        input: {
            step: websalesCopy(title, LOCALE),
            ref: record,
            locale: LOCALE,
            scope: next === undefined ? "item" : "run",
        },
        ...(next === undefined ? {} : { next }),
    })

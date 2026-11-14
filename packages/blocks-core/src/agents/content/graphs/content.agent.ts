import { defineTemplateAgent, type TemplateAgent } from "@nivo-lite/agent-sdk/template"
import { bilingualOf } from "../../../shared/messages/catalog"
import { contentDraftGraph } from "./draft.graph"
import { CONTENT_PLAN_GRAPH_KEY, contentPlanGraph } from "./plan.graph"
import { contentReportGraph } from "./report.graph"

/**
 * The Content agent template: the monthly plan (primary), the writing and approval of each post and the weekly report, over the generic
 * records `blocks-core.content.brand` and `blocks-core.content.post`. It acts through NIVO's own tools only (records, the Second Brain, the team chat): no tool
 * publishes to a social channel yet, so it holds no account.
 */
export const contentAgent: TemplateAgent = defineTemplateAgent({
    key: "content",
    label: bilingualOf("contractAgentContent"),
    accounts: [],
    graphs: [contentPlanGraph, contentDraftGraph, contentReportGraph],
    primary: CONTENT_PLAN_GRAPH_KEY,
})

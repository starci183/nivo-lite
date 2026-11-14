import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { bilingualOf } from "../../../shared/messages/catalog"
import { hiringDigestGraph } from "./digest.graph"
import { HIRING_SCREEN_GRAPH_KEY, hiringScreenGraph } from "./screen.graph"

/**
 * The Hiring agent template: the screening of a candidate (primary) and the morning digest, over the generic records `blocks-core.hiring.job` and
 * `blocks-core.hiring.candidate`. It works with a sending mailbox (`smtp`) for the interview invitation only; without one the invitation step is
 * skipped and the screening still runs.
 */
export const hiringAgent: TemplateAgent = defineTemplateAgent({
    key: "hiring",
    label: bilingualOf("contractAgentHiring"),
    accounts: [PROVIDER.smtp],
    graphs: [hiringScreenGraph, hiringDigestGraph],
    primary: HIRING_SCREEN_GRAPH_KEY,
})

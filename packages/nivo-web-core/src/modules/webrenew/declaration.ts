import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { toolsOfAgent } from "../agent-bundle"
import { WEBRENEW_WORKBENCH_SPEC } from "./specs/webrenew.workbench"
import { webrenewAgent } from "./template/webrenew.agent"

/** The key of the Renewal module. */
export const WEBRENEW = "webrenew"

/**
 * The whole set of tools a step of the Renewal agent may ever use: every tool a node of its graphs calls, derived from the
 * template agent (`toolsOfAgent`), so a published graph of the agent reaches nothing outside its set by construction.
 */
export const WEBRENEW_TOOLS: ReadonlyArray<string> = toolsOfAgent(webrenewAgent)

/**
 * The Renewal module (shown as "Nivo Web-<agent label>"): an agent that faces customers and the team. It reminds customers whose
 * services end soon, takes their answer, quotes so the customer pays first, and renews at the provider once the Accounting agent
 * recorded the payment. Its default provider rights are not declared here: the engine derives them from its template agent (the accounts it lists, ticked from what its node steps ask: `abilitiesOfTemplateAgent`).
 * Its words are its craft (`guidance.ts`): cadence, prices and hours are the company's truths.
 */
export const webrenewModule: ModuleDeclaration = defineModule({
    key: WEBRENEW,
    namespace: WEBRENEW,
    agent: {
        tools: WEBRENEW_TOOLS,
    },
    permissions: [],
    reads: [],
    actions: [],
    specs: [WEBRENEW_WORKBENCH_SPEC],
})

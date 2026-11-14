import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { toolsOfAgent } from "../agent-bundle"
import { WEBDESK_WORKBENCH_SPEC } from "./specs/webdesk.workbench"
import { webdeskAgent } from "./template/webdesk.agent"

/** The key of the Support module. */
export const WEBDESK = "webdesk"

/**
 * The whole set of tools a step of the Support agent may ever use: every tool a node of its graphs calls, derived from the
 * template agent (`toolsOfAgent`), so a published graph of the agent reaches nothing outside its set by construction.
 */
export const WEBDESK_TOOLS: ReadonlyArray<string> = toolsOfAgent(webdeskAgent)

/**
 * The Support module (shown as "Nivo Web-<agent label>"): the front door of the company's Zalo OA. It understands a customer's message,
 * opens a ticket for a fault, checks the system first and proposes a fix to the team or a quote to the customer; renewals go to the
 * Renewal agent. It has no screen, no read and no action of its own: its work is its workflows. Its default provider rights are not declared here: the engine derives them from its template agent (the accounts it lists, ticked from what its node steps ask: `abilitiesOfTemplateAgent`).
 * Its words are its craft (`guidance.ts`): scope, prices and hours are the
 * company's truths.
 */
export const webdeskModule: ModuleDeclaration = defineModule({
    key: WEBDESK,
    namespace: WEBDESK,
    agent: {
        tools: WEBDESK_TOOLS,
    },
    permissions: [],
    reads: [],
    actions: [],
    specs: [WEBDESK_WORKBENCH_SPEC],
})

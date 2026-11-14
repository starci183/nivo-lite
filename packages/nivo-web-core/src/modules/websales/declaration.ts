import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { toolsOfAgent } from "../agent-bundle"
import { WEBSALES_WORKBENCH_SPEC } from "./specs/websales.workbench"
import { websalesAgent } from "./template/websales.agent"

/** The key of the Sales module. */
export const WEBSALES = "websales"

/**
 * The whole set of tools a step of the Sales agent may ever use: every tool a node of its graphs calls, derived from the
 * template agent (`toolsOfAgent`), so a published graph of the agent reaches nothing outside its set by construction.
 */
export const WEBSALES_TOOLS: ReadonlyArray<string> = toolsOfAgent(websalesAgent)

/**
 * The Sales module (shown as "Nivo Web-<agent label>"): the agent of NEW business (AGENTS-GRAPHS §9). It takes a new customer's
 * enquiry handed on by the Support front door or the Mailbox, asks the need, quotes from the CRM's price list, follows up unanswered
 * quotes on working mornings, and, when a person of the team starts it from the team chat, closes the sale (the customer and the
 * purchase records, each by itself) and links an unknown person to a customer of the CRM. It registers on no channel: the
 * Support agent keeps the Zalo OA's door. Its default provider rights are not declared here: the engine derives them from its template agent (the accounts it lists, ticked from what its node steps ask: `abilitiesOfTemplateAgent`).
 * Its words are its craft (`guidance.ts`): what to ask, what may be promised, the follow-up
 * rhythm and the prices are the company's truths and the CRM's price list.
 */
export const websalesModule: ModuleDeclaration = defineModule({
    key: WEBSALES,
    namespace: WEBSALES,
    agent: {
        tools: WEBSALES_TOOLS,
    },
    permissions: [],
    reads: [],
    actions: [],
    specs: [WEBSALES_WORKBENCH_SPEC],
})

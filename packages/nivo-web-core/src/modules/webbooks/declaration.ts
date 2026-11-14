import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { toolsOfAgent } from "../agent-bundle"
import { WEBBOOKS_WORKBENCH_SPEC } from "./specs/webbooks.workbench"
import { webbooksAgent } from "./template/webbooks.agent"

/** The key of the Accounting module. */
export const WEBBOOKS = "webbooks"

/**
 * The whole set of tools a step of the Accounting agent may ever use: every tool a node of its graphs calls, derived from the
 * template agent (`toolsOfAgent`), so a published graph of the agent reaches nothing outside its set by construction.
 */
export const WEBBOOKS_TOOLS: ReadonlyArray<string> = toolsOfAgent(webbooksAgent)

/**
 * The Accounting module (shown as "Nivo Web-<agent label>"): proves the money of a renewal or a purchase on the bank feed and records it in the CRM,
 * drafts the invoice after a renewal and issues it only on the owner's yes, reminds due project receivables and checks supplier invoices
 * against payables. It has no screen, no read and no action of its own: its work is its workflows. Its default provider rights are not declared here: the engine derives them from its template agent (the accounts it lists, ticked from what its node steps ask: `abilitiesOfTemplateAgent`).
 * Its words are its craft (`guidance.ts`): terms, rhythm and who signs an invoice are the company's truths.
 */
export const webbooksModule: ModuleDeclaration = defineModule({
    key: WEBBOOKS,
    namespace: WEBBOOKS,
    agent: {
        tools: WEBBOOKS_TOOLS,
    },
    permissions: [],
    reads: [],
    actions: [],
    specs: [WEBBOOKS_WORKBENCH_SPEC],
})

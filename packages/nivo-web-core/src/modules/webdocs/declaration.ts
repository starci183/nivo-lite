import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { toolsOfAgent } from "../agent-bundle"
import { WEBDOCS_WORKBENCH_SPEC } from "./specs/webdocs.workbench"
import { webdocsAgent } from "./template/webdocs.agent"

/** The key of the Paperwork module. */
export const WEBDOCS = "webdocs"

/**
 * The whole set of tools a step of the Paperwork agent may ever use: every tool a node of its graphs calls, derived from the
 * template agent (`toolsOfAgent`), so a published graph of the agent reaches nothing outside its set by construction.
 */
export const WEBDOCS_TOOLS: ReadonlyArray<string> = toolsOfAgent(webdocsAgent)

/**
 * The Paperwork module (shown as "Nivo Web-<agent label>", early access): a staff-only agent that, when a person of the team asks,
 * finds the documents in the Second Brain and the customer records in the CRM, drafts the paperwork and hands the draft back to the
 * person to check and sign by hand. Its workbench shows only its own work: one seed spec of generic blocks listing its runs that are
 * running or waiting for a person (no CRM data: no agent carries "the CRM"; a CRM table is a data page opened from the desk of the
 * agent whose material it is); it has no read or action of its own: its work is its workflows. Its default provider rights are not declared here: the engine derives them from its template agent (the accounts it lists, ticked from what its node steps ask: `abilitiesOfTemplateAgent`).
 * Its words are its craft (`guidance.ts`).
 */
export const webdocsModule: ModuleDeclaration = defineModule({
    key: WEBDOCS,
    namespace: WEBDOCS,
    agent: {
        tools: WEBDOCS_TOOLS,
    },
    permissions: [],
    reads: [],
    actions: [],
    specs: [WEBDOCS_WORKBENCH_SPEC],
})

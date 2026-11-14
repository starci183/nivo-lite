import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { toolsOfAgent } from "../agent-bundle"
import { WEBMAIL_WORKBENCH_SPEC } from "./specs/webmail.workbench"
import { webmailAgent } from "./template/webmail.agent"

/** The key of the Mailbox module. */
export const WEBMAIL = "webmail"

/**
 * The whole set of tools a step of the Mailbox agent may ever use: every tool a node of its graphs calls, derived from the
 * template agent (`toolsOfAgent`), so a published graph of the agent reaches nothing outside its set by construction.
 */
export const WEBMAIL_TOOLS: ReadonlyArray<string> = toolsOfAgent(webmailAgent)

/**
 * The Mailbox module (shown as "Nivo Web-<agent label>"): a staff-only agent that reads the new mail of the mailboxes it is attached to and tells the
 * team in /chat which mails need a person; since `webmail.triage` v3 it also hands renewal replies, support requests, supplier invoices
 * and enquiries to the agent whose work each is. Its workbench shows only its own work: one seed spec of generic blocks listing its runs
 * that are running or waiting for a person (no CRM data: it holds no CRM account); it has no read or action of its own: its work is its
 * workflows. Its default provider rights are not declared here: the engine derives them from its template agent (the accounts it lists, ticked from what its node steps ask: `abilitiesOfTemplateAgent`).
 * Its words are
 * its craft (`guidance.ts`): what needs a person is the company's truths, and the guidance's fallback where no truth says.
 */
export const webmailModule: ModuleDeclaration = defineModule({
    key: WEBMAIL,
    namespace: WEBMAIL,
    agent: {
        tools: WEBMAIL_TOOLS,
    },
    permissions: [],
    reads: [],
    actions: [],
    specs: [WEBMAIL_WORKBENCH_SPEC],
})

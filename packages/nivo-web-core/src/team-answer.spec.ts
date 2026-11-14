import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import type { AnyTemplateNode, TemplateGraph } from "@nivo-lite/agent-sdk/template"
import { plugin } from "./plugin"
import { CRM_NIVOWEB } from "./crm/nivoweb/api.generated"

/*
 * The chat turns of the NIVO Web agents read the CRM, each only its own part (AGENTS-GRAPHS §9.1 decision 2, §9.5), through ONE shared
 * step factory (`nodes/team-answer`); no customer-facing node searches the CRM; a customer mail is a `nivo.tool.mail.message.send` of the
 * step that writes it, on the mail account, in mode `auto` (the `send_email` work item of the old steps is gone).
 */

const graphs = new Map<string, TemplateGraph>(
    (plugin.templateAgents ?? []).flatMap((agent) => agent.graphs.map((graph) => [graph.key, graph] as const)),
)
const nodes = new Map<string, AnyTemplateNode>([...graphs.values()].flatMap((graph) => [...graph.nodes.entries()]))
const crmOf = (id: string): ReadonlyArray<string> =>
    (nodes.get(id)?.tools ?? []).filter((tool) => Object.values(CRM_NIVOWEB).some((one) => one === tool)).map(String)
const MUTATES = new Map<string, boolean>(
    (plugin.tools ?? []).map((tool) => [tool.id, tool.mutates === true]),
)

describe("the chat turns of the NIVO Web agents", () => {
    it("run the shared team-answer step in Renewal, Accounting, Support and Sales (Sales after its route step); the Mailbox keeps the core turn, Documents its two steps", () => {
        const steps = ["webmail", "webdocs", "webdesk", "webrenew", "webbooks", "websales"].map((module) => [
            module,
            graphs
                .get(`${module}.team-chat`)
                ?.spec.nodes.map((step) => (step.kind === "node" ? step.step : step.kind)) ?? [],
        ])

        // Design change (blocks-core `team-chat.graph.ts`, proven in its own spec): a person declining the team post on its card ends the turn
        // `declined` (`post-declined` if, then the `declined` outcome, no team notice), so every turn that posts ends with that if + outcome.
        expect(steps).toEqual([
            ["webmail", ["team.chat", "if", "team.truth-propose", "team.answer-post", "if", "outcome"]],
            ["webdocs", ["webdocs.read", "webdocs.draft", "team.answer-post", "if", "outcome", "outcome"]],
            ["webdesk", ["webdesk.team-answer", "if", "team.truth-propose", "team.answer-post", "if", "outcome"]],
            ["webrenew", ["webrenew.team-answer", "if", "team.truth-propose", "team.answer-post", "if", "outcome"]],
            ["webbooks", ["webbooks.team-answer", "if", "team.truth-propose", "team.answer-post", "if", "outcome"]],
            // Sales routes first: an answer runs the shared turn, a close or a link is handed to its own graph.
            [
                "websales",
                [
                    "websales.team-route",
                    "websales.team-answer",
                    "if",
                    "team.truth-propose",
                    "team.answer-post",
                    "if",
                    "outcome",
                    "call-workflow",
                    "outcome",
                    "call-workflow",
                    "outcome",
                ],
            ],
        ])
    })

    it("read only each agent's own part of the CRM and write nothing to it", () => {
        expect(crmOf("webrenew.team-answer")).toEqual([
            CRM_NIVOWEB.get_customers,
            CRM_NIVOWEB.get_customers_code,
            CRM_NIVOWEB.get_customers_code_services,
            CRM_NIVOWEB.get_services_expiring,
            CRM_NIVOWEB.get_services_code_status,
            CRM_NIVOWEB.get_renewals_open,
            CRM_NIVOWEB.get_renewals_id,
            CRM_NIVOWEB.get_prices,
        ])
        expect(crmOf("webbooks.team-answer")).toEqual([
            CRM_NIVOWEB.get_customers,
            CRM_NIVOWEB.get_customers_code,
            CRM_NIVOWEB.get_customers_code_invoices,
            CRM_NIVOWEB.get_invoices,
            CRM_NIVOWEB.get_invoice_drafts_id,
            CRM_NIVOWEB.get_customers_code_balance,
            CRM_NIVOWEB.get_receivables_overdue,
            CRM_NIVOWEB.get_payables,
            CRM_NIVOWEB.get_renewals_open,
            CRM_NIVOWEB.get_purchases_open,
        ])
        expect(crmOf("webdesk.team-answer")).toEqual([
            CRM_NIVOWEB.get_customers,
            CRM_NIVOWEB.get_customers_code,
            CRM_NIVOWEB.get_customers_code_services,
            CRM_NIVOWEB.get_services_code_status,
            CRM_NIVOWEB.get_tickets,
            CRM_NIVOWEB.get_tickets_id,
        ])
        expect(crmOf("websales.team-answer")).toEqual([
            CRM_NIVOWEB.get_customers,
            CRM_NIVOWEB.get_customers_code,
            CRM_NIVOWEB.get_customers_code_contracts,
            CRM_NIVOWEB.get_prices,
            CRM_NIVOWEB.get_purchases_open,
            CRM_NIVOWEB.get_purchases_id,
        ])
        const writes = ["webrenew", "webbooks", "webdesk", "websales"].flatMap((module) =>
            crmOf(`${module}.team-answer`).filter((id) => MUTATES.get(id) === true),
        )
        expect(writes).toEqual([])
    })

    it("never search the CRM in a customer's conversation: no node of a customer-facing graph holds the customer search", () => {
        const facing = ["webdesk.front", "webdesk.ticket", "webrenew.answer", "websales.enquiry"].flatMap((key) => {
            const graph = graphs.get(key)
            expect([key, graph !== undefined]).toEqual([key, true])
            return graph === undefined ? [] : [...graph.nodes.values()]
        })

        expect(
            facing.filter((node) => node.tools.some((id) => id === CRM_NIVOWEB.get_customers)).map((node) => node.id),
        ).toEqual([])
    })
})

describe("the mail-writing steps", () => {
    it("declare the mail send on the mail account, in mode `auto`, on the ten graphs that mail a customer", () => {
        // The step's one mode is what the send runs under (`nivo-frame.rights`), and the mail account is among its providers.
        const rows = [...graphs.values()].flatMap((graph) =>
            graph.spec.nodes.flatMap((step) =>
                step.kind === "node" &&
                (graph.nodes.get(step.step)?.tools ?? []).some((tool) => tool === TOOL.mailMessageSend)
                    ? step.accounts
                          .filter((provider) => provider === PROVIDER.smtp)
                          .map((provider) => `${graph.key} ${step.key} ${provider} ${step.mode}`)
                    : [],
            ),
        )
        const callers = [...graphs.values()].flatMap((graph) =>
            graph.spec.nodes.flatMap((step) =>
                step.kind === "node" &&
                (graph.nodes.get(step.step)?.tools ?? []).some((tool) => tool === TOOL.mailMessageSend)
                    ? [`${graph.key} ${step.key}`]
                    : [],
            ),
        )

        expect(rows.sort()).toEqual(
            [
                "webbooks.invoice mail",
                "webbooks.debt-round draft",
                "webdesk.mail-tickets mail-reply-draft",
                "webrenew.round send",
                "webrenew.answer tell",
                "webrenew.renew renewed-tell",
                "websales.round follow",
                "websales.close pay",
                "websales.won tell",
                "websales.mail-enquiries draft",
            ]
                .map((row) => `${row} ${PROVIDER.smtp} auto`)
                .sort(),
        )
        expect(callers.sort()).toEqual(rows.map((row) => row.split(" ").slice(0, 2).join(" ")).sort())
    })
})

import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { teamChatGraphOf } from "@nivo-lite/blocks-core"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { webbooksTeamAnswerNode } from "../webbooks/team-answer.node"
import { webdeskTeamAnswerNode } from "../webdesk/team-answer.node"
import { webrenewTeamAnswerNode } from "../webrenew/team-answer.node"
import { websalesTeamAnswerNode } from "../websales/team-answer.node"

/** The four chat turns of the NIVO Web agents that read the CRM, by module. */
const TURNS: ReadonlyArray<readonly [string, AnyTemplateNode]> = [
    ["webrenew", webrenewTeamAnswerNode],
    ["webbooks", webbooksTeamAnswerNode],
    ["webdesk", webdeskTeamAnswerNode],
    ["websales", websalesTeamAnswerNode],
]

/** Every CRM tool a node holds, in its order. */
const CRM_IDS: ReadonlySet<string> = new Set(Object.values(CRM_NIVOWEB))
const crmOf = (node: AnyTemplateNode): ReadonlyArray<string> => node.tools.filter((id) => CRM_IDS.has(id))

describe("the chat turns of the NIVO Web agents (`<module>.team-answer`)", () => {
    it.each(TURNS)("%s.team-answer conforms: a clean definition, every worked example holds", async (module, node) => {
        expect(node.id).toBe(`${module}.team-answer`)
        expect(await checkTemplateNode(node)).toEqual([])
    })

    it("read only each agent's own part of the CRM", () => {
        expect(crmOf(webrenewTeamAnswerNode)).toEqual([
            CRM_NIVOWEB.get_customers,
            CRM_NIVOWEB.get_customers_code,
            CRM_NIVOWEB.get_customers_code_services,
            CRM_NIVOWEB.get_services_expiring,
            CRM_NIVOWEB.get_services_code_status,
            CRM_NIVOWEB.get_renewals_open,
            CRM_NIVOWEB.get_renewals_id,
            CRM_NIVOWEB.get_prices,
        ])
        expect(crmOf(webbooksTeamAnswerNode)).toEqual([
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
        expect(crmOf(webdeskTeamAnswerNode)).toEqual([
            CRM_NIVOWEB.get_customers,
            CRM_NIVOWEB.get_customers_code,
            CRM_NIVOWEB.get_customers_code_services,
            CRM_NIVOWEB.get_services_code_status,
            CRM_NIVOWEB.get_tickets,
            CRM_NIVOWEB.get_tickets_id,
        ])
        expect(crmOf(websalesTeamAnswerNode)).toEqual([
            CRM_NIVOWEB.get_customers,
            CRM_NIVOWEB.get_customers_code,
            CRM_NIVOWEB.get_customers_code_contracts,
            CRM_NIVOWEB.get_prices,
            CRM_NIVOWEB.get_purchases_open,
            CRM_NIVOWEB.get_purchases_id,
        ])
    })

    it.each(TURNS)(
        "%s.team-answer writes nothing: it acts through the one crm account, `auto`, no post, no proposal tool",
        (_module, node) => {
            const crm = crmOf(node)
            // `nivo-frame.rights`: one provider (the CRM) and one mode; every CRM tool it calls is a read of that account.
            expect(node.accounts).toEqual([CRM_NIVOWEB_PROVIDER])
            expect(node.mode).toBe("auto")
            expect(crm.length).toBeGreaterThan(0)
            expect(node.tools).not.toContain(TOOL.teamMessagePost)
            expect(node.tools).not.toContain(TOOL.brainChangePropose)
            // The truth and document reads are the default of every AI step (`DEFAULT_AI_READ_TOOLS`): the node lists only the CRM reads.
            expect(node.tools.filter((id) => !CRM_IDS.has(id))).toEqual([])
            expect(node.requires ?? []).toEqual([])
        },
    )

    it.each(TURNS)(
        "%s.team-answer calls the AI and answers as `team.chat` does: `{ answer, proposal }`",
        (_module, node) => {
            expect(node.model).toBe("claude-sonnet-5-5")
            expect(node.output.parse({ answer: "Da ghi nhan.", proposal: null })).toEqual({
                answer: "Da ghi nhan.",
                proposal: null,
            })
        },
    )

    it.each(TURNS)(
        "%s.team-answer answers a staff member's money question politely: the refused read, no figure, nothing proposed",
        (_module, node) => {
            const money = node.examples.find((example) => example.name.startsWith("staff asking for money"))
            const turn = money?.agent?.[0]
            expect(turn !== undefined && "answer" in turn ? turn.calls?.map((call) => call.answer) : null).toEqual([
                { ok: false, refusal: "not_for_standing", facts: { standing: "staff" } },
            ])
            expect(money?.output).toEqual({ answer: expect.not.stringMatching(/\d/), proposal: null })
        },
    )

    it.each(TURNS)(
        "%s.team-answer fits blocks-core's team-chat graph: answer, has-proposal, propose, post",
        (module, node) => {
            const graph = teamChatGraphOf(module, node)
            expect(graph.key).toBe(`${module}.team-chat`)
            expect(
                graph.spec.nodes.map((step) => `${step.key}:${step.kind === "node" ? step.step : step.kind}`),
            ).toEqual([
                `answer:${module}.team-answer`,
                "has-proposal:if",
                "propose:team.truth-propose",
                "post:team.answer-post",
                // A person declining the post on its card ends the turn `declined` (blocks-core `team-chat.graph.ts`, no team notice).
                "post-declined:if",
                "declined:outcome",
            ])
        },
    )
})

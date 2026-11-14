import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webdeskText } from "../../modules/webdesk/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { REFERENCE_NOTICE, answered, crmAnswered } from "../web-answers"
import {
    type CheckedTicket,
    type Given,
    type NodeSchema,
    LINE_MAX,
    type TeamLocale,
    TEXT_MAX,
    TICKET_MISSING,
    checkedTicketSchema,
    intakeTicketId,
    localeSchema,
    nullableId,
    serviceCodesSchema,
} from "./desk-shapes"

/** The ticket to check: the customer's words, the customer and the services it is about. */
export type CheckInput = {
    /** Null only on a run the graph ended `declined` before this step (`intakeTicketId`). */
    readonly ticketId: string | null
    /** The message text the node works from. */
    readonly text: string
    /** A one-line summary of what was said, kept for the team notice and later steps. */
    readonly summary: string
    /** The CRM code of the customer this concerns; null when the person is not matched to one. */
    readonly customerCode: string | null
    /** The CRM codes of the services this concerns. */
    readonly serviceCodes: ReadonlyArray<string>
    /** The language the team notice or customer text is written in. */
    readonly locale: TeamLocale
}

/** The input as a graph binds it: the customer may be left out. */
export type CheckGiven = Given<CheckInput, "ticketId" | "customerCode">

type NoParams = Record<string, never>

/** What the agent may read besides the default truth and document reads: the live state of the services, the customer's services and contracts. */
const TOOLS = [
    CRM_NIVOWEB.get_services_code_status,
    CRM_NIVOWEB.get_customers_code_services,
    CRM_NIVOWEB.get_customers_code_contracts,
    // Listed only because `requires` names it: the other truth and document reads are the default of every AI step.
    TOOL.brainSearch,
] as const

const params: z.ZodType<NoParams> = z.strictObject({})
const input: NodeSchema<CheckInput, CheckGiven> = z.object({
    ticketId: intakeTicketId,
    text: z.string().min(1).max(TEXT_MAX),
    summary: z.string().min(1).max(LINE_MAX),
    customerCode: nullableId,
    serviceCodes: serviceCodesSchema,
    locale: localeSchema,
})
const output: z.ZodType<CheckedTicket> = checkedTicketSchema

const GOAL =
    "Check the system BEFORE anyone answers the customer. For each service the ticket is about, read its live state; when none is " +
    "named and the customer is known, find the likely one in their services. Then decide `covered` from the company's truths, never " +
    "from memory: search the truths for the warranty and support scope (what is fixed free, what is quoted extra work, the support " +
    "hours), read the customer's contracts for which applies and whether it is still in force, and where no truth answers search the " +
    "documents and read the passage before relying on it. Name in `basis` exactly what you relied on; when no truth or document settles " +
    "it, say so in `basis` and answer `covered` false so a person decides with the quote. Write `diagnosis` in the team's language " +
    "(`locale`): what each check showed and what is most likely wrong. You only read: never change anything, never contact the customer."

const STATUS = {
    serviceCode: "EXAMPLE-HOST",
    state: "active",
    expiresOn: "2027-03-01",
    checkedBy: "mock",
    note: "Hosting dang chay",
}
const ARTICLE3 = {
    notice: REFERENCE_NOTICE,
    facts: [
        {
            id: "f-article-3",
            text: "Bao hanh 12 thang: loi do NIVO Web lam ra duoc sua mien phi; chinh sua giao dien moi la viec co tinh phi.",
            since: "2026-01-01",
        },
    ],
}
const NO_TRUTH = { notice: REFERENCE_NOTICE, facts: [] }
const NO_PASSAGE = {
    notice: "Passages are what a document of the business SAYS, as of its date.",
    legs: ["words"],
    hits: [],
    next: null,
}
const CONTRACTS = {
    items: [{ code: "HD-0001", title: "Hop dong thiet ke website", signedOn: "2026-03-01", state: "active" }],
    nextCursor: null,
}

const COVERED_DIAGNOSIS =
    "Hosting EXAMPLE-HOST dang chay; loi 500 nam o website, nhieu kha nang do plugin hoac cau hinh: can nguoi kiem tra."
const COVERED_BASIS = "Su that f-article-3 (bao hanh 12 thang, tu 2026-01-01); hop dong HD-0001 con hieu luc."
const EDIT_DIAGNOSIS = "Yeu cau doi giao dien, khong phai loi he thong."
const EDIT_BASIS = "Chua co su that hay tai lieu nao noi chinh sua giao dien co mien phi khong."

/** The ticket of the worked examples. */
const TICKET: CheckGiven = {
    ticketId: "TK-0001",
    text: "Web cong ty minh bi loi 500 tu sang",
    summary: "Khach KH-0001 bao web example.vn loi 500 tu sang.",
    customerCode: "KH-0001",
    serviceCodes: ["EXAMPLE-HOST"],
    locale: "vi",
}

/**
 * `webdesk.check` (Check the system first): an agent step that reads before anyone answers: the live state of the ticket's
 * services, the customer's contracts, and the company's truths on the warranty and support scope (documents when no truth
 * answers). It answers a diagnosis for the team, whether the request is covered (free) or extra work (quoted), and what that
 * rests on. It reads only: there is no tool here that changes a site, a host or a record. What is covered is the company's
 * truths, never coded here. Converted in place.
 */
export const webdeskCheckNode: TemplateNode<
    NodeSchema<CheckInput, CheckGiven>,
    z.ZodType<CheckedTicket>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webdesk.check",
    title: webdeskText("node.check.title"),
    description: { vi: "Ki\u1ec3m tra t\u00ecnh tr\u1ea1ng d\u1ecbch v\u1ee5, h\u1ee3p \u0111\u1ed3ng v\u00e0 ph\u1ea1m vi b\u1ea3o h\u00e0nh tr\u01b0\u1edbc khi ai tr\u1ea3 l\u1eddi, \u0111\u1ec3 bi\u1ebft y\u00eau c\u1ea7u \u0111\u01b0\u1ee3c b\u1ea3o h\u00e0nh hay t\u00ednh ph\u00ed.", en: "Checks the service state, the contracts and the warranty scope before anyone answers, to tell whether the request is covered or charged." },
    tools: [...TOOLS],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    requires: [TOOL.brainSearch],
    sensitive: { text: "pii", summary: "pii" },
    run: (given, context) => {
        if (given.ticketId === null) return context.fail({ kind: "cannot", why: TICKET_MISSING })
        return context.agent.run({ goal: GOAL, input: given, output, maxTurns: 8, tools: [...TOOLS] })
    },
    examples: [
        {
            name: "reads the hosting state, the warranty truth and the contract: a site error inside the warranty is covered",
            params: {},
            input: TICKET,
            agent: [
                {
                    answer: { ticketId: "TK-0001", diagnosis: COVERED_DIAGNOSIS, covered: true, basis: COVERED_BASIS },
                    calls: [
                        { id: CRM_NIVOWEB.get_services_code_status, args: { code: "EXAMPLE-HOST" }, answer: crmAnswered(STATUS) },
                        {
                            id: TOOL.brainSearch,
                            args: { query: "bao hanh sua loi website mien phi" },
                            answer: answered(ARTICLE3),
                        },
                        { id: CRM_NIVOWEB.get_customers_code_contracts, args: { code: "KH-0001" }, answer: crmAnswered(CONTRACTS) },
                    ],
                },
            ],
            output: { ticketId: "TK-0001", diagnosis: COVERED_DIAGNOSIS, covered: true, basis: COVERED_BASIS },
        },
        {
            name: "with no truth on the scope, says so and leaves the decision to a person through a quote",
            params: {},
            input: {
                ...TICKET,
                text: "Doi giup minh mau nut tren trang chu",
                summary: "Khach muon doi mau nut trang chu.",
                serviceCodes: [],
            },
            agent: [
                {
                    answer: { ticketId: "TK-0001", diagnosis: EDIT_DIAGNOSIS, covered: false, basis: EDIT_BASIS },
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "chinh sua giao dien co tinh phi" },
                            answer: answered(NO_TRUTH),
                        },
                        {
                            id: TOOL.brainPassageSearch,
                            args: { query: "chinh sua giao dien" },
                            answer: answered(NO_PASSAGE),
                        },
                    ],
                },
            ],
            output: { ticketId: "TK-0001", diagnosis: EDIT_DIAGNOSIS, covered: false, basis: EDIT_BASIS },
        },
        {
            name: "no ticket (a person declined the intake's write): nothing is checked",
            params: {},
            input: { ...TICKET, ticketId: null },
            failure: { kind: "cannot", why: TICKET_MISSING },
        },
    ],
})

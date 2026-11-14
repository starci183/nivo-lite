import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { crmAnswered, refused } from "../web-answers"
import { AUTHOR } from "./desk.fixtures"
import { ID_MAX, NOTE_MAX, type PlannedStatus, TICKET_MISSING, intakeTicketId } from "./desk-shapes"
import { webdeskText } from "../../modules/webdesk/copy"

/** The ticket, the state its plan sets, the note an earlier step wrote, and the name the note is written under. */
export interface TicketNoteInput {
    /** Null only on a run the graph ended `declined` before this step (`intakeTicketId`). */
    readonly ticketId: string | null
    /** The state the ticket is in. */
    readonly status: PlannedStatus
    /** The note to write. */
    readonly note: string
    /** Who writes the note. */
    readonly author: string
}

/** The ticket and the state its plan sets (the CRM holds it unless a person declined the update), and whether they declined it. */
export interface TicketNoteOutput {
    /** The id of the ticket. */
    readonly ticketId: string
    /** The status the ticket now has. */
    readonly status: PlannedStatus
    /** True when a person declined the update (DECLINED rule 1): the CRM was not changed. */
    readonly declined: boolean
}

type NoParams = Record<string, never>

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<TicketNoteInput> = z.object({
    ticketId: intakeTicketId,
    status: z.enum(["in_progress", "quoted"]),
    note: z.string().min(1).max(NOTE_MAX),
    author: z.string().min(1).max(120),
})
const output: z.ZodType<TicketNoteOutput> = z.object({
    ticketId: z.string().min(1).max(ID_MAX),
    status: z.enum(["in_progress", "quoted"]),
    declined: z.boolean(),
})

/** The refusal of an update a person said no to: their decision, never a failure. */
const DECLINED = "declined"

const NOTE = "Trong bao hanh; de xuat xem log loi PHP. Da bao khach: dang kiem tra, chua hua thoi gian."

/**
 * `webdesk.ticket-note` (Note the ticket): one CRM update that sets a planned ticket's state (`in_progress` when covered,
 * `quoted` when not: plain logic of the plan step) and adds the short note of the plan and of what the customer was told. Split
 * from `webdesk.mail-plan` and `webdesk.respond-told`. No AI call. The update runs by itself (the node declares `auto`); a person who declines (a step the workflow sets to `ask`)
 * it decided so, and the step returns `declined` (the graph tells the team and ends `declined`); any other refusal stops the step.
 */
export const webdeskTicketNoteNode: TemplateNode<
    z.ZodType<TicketNoteInput>,
    z.ZodType<TicketNoteOutput>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webdesk.ticket-note",
    title: webdeskText("node.ticket-note.title"),
    description: { vi: "C\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i phi\u1ebfu v\u00e0 ghi ch\u00fa ng\u1eafn v\u1ec1 k\u1ebf ho\u1ea1ch v\u00e0 \u0111i\u1ec1u \u0111\u00e3 b\u00e1o kh\u00e1ch.", en: "Updates the ticket's state and adds a short note of the plan and what the customer was told." },
    tools: [CRM_NIVOWEB.patch_tickets_id],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    sensitive: { note: "pii" },
    run: async (given, context) => {
        const ticketId = given.ticketId
        if (ticketId === null) return context.fail({ kind: "cannot", why: TICKET_MISSING })
        const noted = await context.tools.call(CRM_NIVOWEB.patch_tickets_id, {
            id: ticketId,
            status: given.status,
            note: given.note,
            author: given.author,
        })
        if (!noted.ok && noted.declined === true) return { ticketId, status: given.status, declined: true }
        if (!noted.ok)
            return context.fail({ kind: "cannot", why: `ticket_update_refused:${noted.refusal}` }, noted.facts)
        return { ticketId, status: given.status, declined: false }
    },
    examples: [
        {
            name: "sets a covered ticket in progress with the note of the plan",
            params: {},
            input: { ticketId: "TK-0001", status: "in_progress", note: NOTE, author: AUTHOR },
            tools: [
                {
                    id: CRM_NIVOWEB.patch_tickets_id,
                    args: { id: "TK-0001", status: "in_progress", note: NOTE, author: AUTHOR },
                    answer: crmAnswered({ id: "TK-0001", status: "in_progress" }),
                },
            ],
            output: { ticketId: "TK-0001", status: "in_progress", declined: false },
        },
        {
            name: "a refused update stops the step",
            params: {},
            input: { ticketId: "TK-0001", status: "quoted", note: "Da gui khach bao gia.", author: AUTHOR },
            tools: [
                {
                    id: CRM_NIVOWEB.patch_tickets_id,
                    args: { id: "TK-0001", status: "quoted", note: "Da gui khach bao gia.", author: AUTHOR },
                    answer: refused("ticket_closed", { id: "TK-0001" }),
                },
            ],
            failure: { kind: "cannot", why: "ticket_update_refused:ticket_closed" },
        },
        {
            name: "a person declines the update: their decision is returned, the CRM is not changed",
            params: {},
            input: { ticketId: "TK-0001", status: "in_progress", note: NOTE, author: AUTHOR },
            tools: [
                {
                    id: CRM_NIVOWEB.patch_tickets_id,
                    args: { id: "TK-0001", status: "in_progress", note: NOTE, author: AUTHOR },
                    answer: refused(DECLINED),
                },
            ],
            output: { ticketId: "TK-0001", status: "in_progress", declined: true },
        },
        {
            name: "no ticket (a person declined the intake's write): nothing is updated",
            params: {},
            input: { ticketId: null, status: "in_progress", note: NOTE, author: AUTHOR },
            failure: { kind: "cannot", why: TICKET_MISSING },
        },
    ],
})

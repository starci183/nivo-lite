import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import {
    ID_MAX,
    NOTE_MAX,
    type TicketChannel,
    type TicketKind,
    ticketChannelSchema,
    ticketKindSchema,
} from "./desk-shapes"

/**
 * The one CRM write of a ticket intake (`webdesk.ticket-open`, `webdesk.intake-linked`): the agent DECIDES whether the request is
 * the same problem as a ticket still open (a meaning, so the model's) and writes the words; the step's code then makes the one
 * write the decision names and reads the CRM's answer (CONVENTIONS ADDENDUM 1: one write per node, made by the node).
 */

/** Open a new ticket, or add the request to one still open for the same problem. */
export type TicketDecision =
    | {
          readonly kind: "open"
          readonly ticketKind: TicketKind
          readonly channel: TicketChannel
          readonly subject: string
      }
    | { readonly kind: "note"; readonly ticketId: string; readonly note: string }

/** The schema of the decision, each arm described for the model. */
export const ticketDecisionSchema: z.ZodType<TicketDecision> = z
    .discriminatedUnion("kind", [
        z.object({
            kind: z.literal("open"),
            ticketKind: ticketKindSchema,
            channel: ticketChannelSchema.describe(
                "Where the request came in, as the CRM names it: the `channel` you were given (`email` for a mail; a chat channel the CRM does not list is `chat`).",
            ),
            subject: z.string().min(1).max(200).describe("One line naming the problem, in the team's language."),
        }),
        z.object({
            kind: z.literal("note"),
            ticketId: z
                .string()
                .min(1)
                .max(ID_MAX)
                .describe("The `id` of the ticket still open for the SAME problem, exactly as the list answered it."),
            note: z
                .string()
                .min(1)
                .max(NOTE_MAX)
                .describe("The short note that adds this request to that ticket, in the team's language."),
        }),
    ])
    .describe("open: no ticket is still open for this same problem; note: add this request to the one that is.")

/** What the write carries besides the decision: who the request is for, where it came in, and the team's one line. */
export interface TicketRequest {
    /** The customer's code as a CRM answer gave it, or null. */
    readonly customerCode: string | null
    /** The services the request is about. */
    readonly serviceCodes: ReadonlyArray<string>
    /** The conversation or the mail it came in, by its id, or null. */
    readonly sourceRef: string | null
    /** What the customer reports, in the team's language. */
    readonly summary: string
    /** The name a note is written under. */
    readonly author: string
}

/** The refusal of a write a person said no to (DECLINED rule 1): their decision, never a failure. */
export const DECLINED = "declined"

/** What the write left: the ticket's id as the CRM answered it, or no ticket because a person declined the write. */
export type TicketWritten =
    { readonly ticketId: string; readonly declined: false } | { readonly ticketId: null; readonly declined: true }

/**
 * Makes the decision's one write and answers the ticket's id as the CRM answered it. A person who declines the `ask` write decided so:
 * the step RETURNS `declined` (no ticket) and the graph routes it to the team's notice (DECLINED rule 1). Any other refusal (the CRM's
 * business refusal) ends the step `cannot` with the refusal and the facts: the ticket is the graph's purpose; the engine reports it (no
 * holding line, no retry here).
 */
export const writeTicketOf = async (
    context: NodeContext,
    decision: TicketDecision,
    request: TicketRequest,
): Promise<TicketWritten> => {
    const written =
        decision.kind === "note"
            ? await context.tools.call(CRM_NIVOWEB.patch_tickets_id, {
                  id: decision.ticketId,
                  note: decision.note,
                  author: request.author,
              })
            : await context.tools.call(CRM_NIVOWEB.post_tickets, {
                  ...(request.customerCode === null ? {} : { customerCode: request.customerCode }),
                  kind: decision.ticketKind,
                  channel: decision.channel,
                  subject: decision.subject,
                  summary: request.summary,
                  ...(request.serviceCodes.length === 0 ? {} : { serviceCodes: [...request.serviceCodes] }),
                  ...(request.sourceRef === null ? {} : { sourceRef: request.sourceRef }),
              })
    if (!written.ok && written.declined === true) return { ticketId: null, declined: true }
    if (!written.ok)
        return context.fail({ kind: "cannot", why: `ticket_write_refused:${written.refusal}` }, written.facts)
    const id = written.value["id"]
    if (typeof id !== "string") return context.fail({ kind: "cannot", why: "ticket_write_without_id" })
    return { ticketId: id, declined: false }
}

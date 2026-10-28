import type { RenewalNotification } from "@modules/domain/channels"
import type { ProposalFieldValue } from "@modules/domain/work-items"

/** The stages of a lead the sales AI may move it to. */
const LEAD_STAGES: ReadonlySet<string> = new Set(["new", "qualified", "proposal", "won", "lost"])

/** The text of a proposal field; an empty text when the field is missing. */
export const textOf = (value: ProposalFieldValue | undefined): string =>
    value === undefined || value === null ? "" : String(value)

/** The number in a proposal field, or null when the field holds none. */
export const numberOf = (value: ProposalFieldValue | undefined): number | null =>
    typeof value === "number" ? value : null

/** Where the owner finds a customer. */
export const leadHref = (leadId: string | null | undefined): string =>
    leadId === undefined || leadId === null ? "/chat" : `/leads/${leadId}`

/** The stage a text names, or null when it is not a stage. */
export const stageOf = (raw: string): string | null => (LEAD_STAGES.has(raw) ? raw : null)

/** The non-empty parts joined with a middle dot. */
export const dotted = (parts: ReadonlyArray<string | null | undefined>): string =>
    parts.filter((part): part is string => part !== undefined && part !== null && part !== "").join(" · ")

/** The history lines a classification prompt reads: the summary with the first 400 characters of its evidence. */
export const historyLine = (summary: string, evidence: string | null): string =>
    evidence === null || evidence === "" ? summary : `${summary}: ${evidence.slice(0, 400)}`

/** The first of the texts that is not empty; an empty text when all are. */
export const firstText = (texts: ReadonlyArray<string>): string => texts.find((text) => text !== "") ?? ""

/**
 * The ZNS renewal notice a proposal carries (the `renewal_*` fields the contract renewal automation puts through the gate), or
 * undefined when the proposal is not a renewal or lacks a fact the template needs; the message then goes by chat only.
 */
export const renewalNoticeOf = (
    fields: Readonly<Record<string, ProposalFieldValue>>,
): RenewalNotification | undefined => {
    const plan = textOf(fields.renewal_plan)
    const endDate = textOf(fields.renewal_end_date)
    const invoiceNumber = textOf(fields.renewal_invoice)
    const amount = Number(textOf(fields.renewal_amount_vnd))
    if (plan === "" || endDate === "" || invoiceNumber === "" || !Number.isFinite(amount) || amount <= 0)
        return undefined
    return {
        kind: "renewal",
        phone: textOf(fields.renewal_phone) || null,
        fields: {
            customerName: textOf(fields.renewal_customer),
            plan,
            endDate,
            amount,
            transferContent: textOf(fields.renewal_transfer_content),
            invoiceNumber,
        },
    }
}

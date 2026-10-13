import { Injectable } from "@nestjs/common"
import { EvidenceService, WorkEngineService, formatVnd } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { WorkItemsService } from "@modules/domain/work-items"
import { claimKeyOf } from "@modules/domain/work-performers"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ClaimStarted, PaymentClaim } from "./customer-turns.contracts"

/** The action that checks a payment against the bank before an invoice is marked paid. */
const RECONCILE = "reconcile_payment"
/** Statuses after which a customer may claim again: a new claim is then a new check. */
const CLOSED: ReadonlySet<string> = new Set(["rejected", "failed"])
const CLAIM_MAX = 500
const EVIDENCE_MAX = 300

@Injectable()
/**
 * The customer says they paid an open invoice. A claim is not evidence: it becomes ONE reconcile_payment check per invoice that waits
 * for the owner (unclear outcome, the invoice as the single candidate), who looks at the bank and approves with a basis. Nothing is
 * marked paid here. A repeated claim while a check is open creates nothing new; after a rejected check the customer may claim again.
 */
export class PaymentClaimsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly engine: WorkEngineService,
        private readonly items: WorkItemsService,
        private readonly evidence: EvidenceService,
        private readonly leads: LeadRecordsService,
    ) {}

    /** Opens the check of the claim, or joins the one already open. */
    async start(ctx: WorkContext, invoice: InvoiceRow, claim: PaymentClaim): Promise<ClaimStarted> {
        const base = claimKeyOf(invoice.id)
        const open = await this.items.latestOfKey(ctx.workspaceId, RECONCILE, base)
        if (open !== null && !CLOSED.has(open.status)) {
            await this.evidence.log(ctx, {
                lead_id: invoice.lead_id,
                work_item_id: open.id,
                kind: "core.duplicate_blocked",
                actor: "NIVO",
                summary: this.text(ctx, "workDuplicate", {}),
                evidence: claim.claim.slice(0, EVIDENCE_MAX),
            })
            return { created: false }
        }
        const name = invoice.lead_id === null ? "—" : await this.nameOf(ctx.workspaceId, invoice.lead_id)
        const amount = formatVnd(invoice.amount_vnd, ctx.locale)
        await this.engine.runWork(ctx, {
            action: RECONCILE,
            subject_type: "invoice",
            subject_id: invoice.id,
            lead_id: invoice.lead_id,
            inbound_event_id: claim.inboundEventId,
            origin: "live",
            dedupeKey: open === null ? base : `${base}:${claim.inboundEventId}`,
            preset: true,
            forceAsk: "unclear_outcome",
            seed: {
                summary: this.text(ctx, "claimSummary", {
                    name,
                    amount,
                    no: invoice.invoice_no,
                    channel: claim.channelLabel,
                }),
                amount_vnd: invoice.amount_vnd,
                outcome: "unclear",
                candidates: [
                    {
                        id: invoice.id,
                        label: this.text(ctx, "candidateLabel", { no: invoice.invoice_no, name, amount }),
                        amount_vnd: invoice.amount_vnd,
                    },
                ],
                fields: {
                    amount_vnd: invoice.amount_vnd,
                    reference: invoice.invoice_no,
                    payer: name,
                    claim: claim.claim.slice(0, CLAIM_MAX),
                    conversation_id: claim.conversationId,
                },
            },
        })
        return { created: true }
    }

    private async nameOf(workspaceId: string, leadId: string): Promise<string> {
        const lead = await this.leads.find(workspaceId, leadId)
        return lead?.contact_name ?? "—"
    }

    private text(ctx: WorkContext, key: string, params: Readonly<Record<string, string>>): string {
        return this.catalog.get(`customerTurns.${key}`, params, ctx.locale)
    }
}

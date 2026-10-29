import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { RunStep } from "@modules/domain/automation-runs"
import { vietQrUrl, WorkspacePaymentAccountService } from "@modules/domain/channel-connections"
import { InvoicesService } from "@modules/domain/invoices"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AutomationMessagesService } from "./automation-messages.service"
import type { RenewalPayment } from "./automations.contracts"
import { readLastCustomerMessage } from "./automation-reads.query"
import type { ContractRead, ConversationRead } from "./automation-reads.contracts"
import { placeholdersOf } from "./policies/config.policy"
import { instantOf } from "./policies/format.policy"
import { dongDigits, isBillableAmount, transferContentOf } from "./policies/renewal-payment.policy"

/** Zalo lets an OA write to a customer only within 48 hours of the customer's last message. */
const ZALO_WINDOW_MS = 48 * 3_600_000
/** The variable whose place in the owner's wording carries the payment lines instead of the fixed tail. */
const QR_VARIABLE = "link_qr"

@Injectable()
/**
 * What a contract renewal message needs to be paid: the renewal invoice of the period, the payment lines with the VietQR link into
 * the workspace's own bank account, and a warning when Zalo will not let the message out.
 */
export class AutomationRenewalPaymentService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly messages: AutomationMessagesService,
        private readonly invoices: InvoicesService,
        private readonly paymentAccounts: WorkspacePaymentAccountService,
    ) {}

    /**
     * The renewal invoice of the contract period (issued once, reused on a re-run) and the payment lines of the message; none for a
     * contract without a positive amount. The lines follow the message word for word unless the owner's wording (`body`) places
     * the QR link itself, in which case the values must survive any rewrite. Without a bank account that stores a full number the
     * lines carry no QR link, and the run tells the owner where to enter it.
     */
    async paymentOf(
        workspaceId: string,
        contract: ContractRead,
        leadId: string,
        body: string,
    ): Promise<RenewalPayment | null> {
        if (!isBillableAmount(contract.amount_vnd)) return null
        const say = this.messages.say.bind(this.messages)
        const { invoice, created } = await this.invoices.issueRenewal({
            workspaceId,
            contractId: contract.id,
            leadId,
            amountVnd: contract.amount_vnd,
            periodEndsOn: contract.ends_on,
            issuedBy: null,
        })
        const amountVnd = Number(invoice.amount_vnd)
        const content = transferContentOf(invoice.invoice_no)
        const amount = say("renewal.money", { amount: dongDigits(amountVnd) })
        const account = await this.paymentAccounts.accountOf(workspaceId)
        const link = account === null ? "" : vietQrUrl(account, amountVnd, content)
        const steps: Array<RunStep> = [
            {
                label: say(created ? "renewal.invoiceIssued" : "renewal.invoiceReused", {
                    invoice: invoice.invoice_no,
                }),
                status: "done",
                detail: say("renewal.invoiceDetail", { amount, content }),
            },
        ]
        if (account === null) {
            steps.push({ label: say("renewal.noAccount"), status: "skipped", detail: say("renewal.noAccountDetail") })
        }
        const lines = [
            say("renewal.pay.intro"),
            say("renewal.pay.invoice", { invoice: invoice.invoice_no }),
            say("renewal.pay.amount", { amount }),
            say("renewal.pay.content", { content }),
            ...(link === "" ? [] : [say("renewal.pay.qr", { url: link })]),
        ]
        const placed = placeholdersOf(body).has(QR_VARIABLE)
        return {
            vars: { so_hoa_don: invoice.invoice_no, so_tien: amount, noi_dung_ck: content, link_qr: link },
            fixedTail: placed ? undefined : lines.join("\n"),
            keepExact: placed ? [invoice.invoice_no, content, link].filter((value) => value !== "") : undefined,
            steps,
            invoiceNo: invoice.invoice_no,
            amountVnd,
            transferContent: content,
        }
    }

    /**
     * A warning step when the customer writes on Zalo and last wrote more than 48 hours ago: Zalo refuses a message the shop writes
     * first, so the owner learns it before approving. None otherwise, a customer who never wrote included (delivery lets it try).
     */
    async zaloWindowSteps(conversation: ConversationRead): Promise<ReadonlyArray<RunStep>> {
        if (conversation.channel !== "zalo") return []
        const last = await readLastCustomerMessage(this.entityManager, conversation.id)
        if (last === undefined || this.clock.now().getTime() - instantOf(last.created_at) <= ZALO_WINDOW_MS) return []
        const say = this.messages.say.bind(this.messages)
        return [{ label: say("renewal.zaloWindow"), status: "skipped", detail: say("renewal.zaloWindowDetail") }]
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { PaymentReconciledPayload } from "@modules/events/api"
import { displayDayOf } from "./contract-term.policy"
import { ContractsService } from "./contracts.service"

/** The locale of the lines a renewal writes on its own: the workspace owners read them in Vietnamese. */
const RECORD_LOCALE = "vi"
/** The actor of the lines the system writes on its own. */
const SYSTEM_ACTOR = "NIVO"

@Injectable()
/** What a settled renewal invoice does to its contract: the effect of the `contracts` reactor of `payment_reconciled`. */
export class ContractRenewalService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        private readonly contracts: ContractsService,
        private readonly events: EventsService,
    ) {}

    /**
     * Moves the contract of a paid renewal invoice to its next term and says so in the evidence log, once per delivery key: the inbox
     * claim, the term change and the evidence line commit together. A payment that renews nothing, a renewal already applied and a
     * term that moved change nothing. The payment itself stands whatever happens here: a failure leaves the message to be retried.
     */
    async renewForPaidInvoice(consumer: string, dedupeKey: string, payment: PaymentReconciledPayload): Promise<void> {
        if (payment.contractId === undefined || payment.periodEndsOn === undefined) return
        const { contractId, periodEndsOn } = payment
        await this.entityManager.transaction(async (tx) => {
            if (!(await this.inbox.claim(consumer, dedupeKey, tx))) return
            const renewal = await this.contracts.extendForPaidRenewal(
                payment.workspaceId,
                contractId,
                periodEndsOn,
                payment.invoiceNo,
                tx,
            )
            if (!renewal.extended) return
            await this.events.record(
                {
                    workspaceId: payment.workspaceId,
                    leadId: payment.leadId ?? null,
                    workItemId: payment.workItemId,
                    kind: "contract.renewed",
                    actor: SYSTEM_ACTOR,
                    summary: this.messages.get(
                        "contracts.renewedByInvoice",
                        { until: displayDayOf(renewal.contract.endsOn), no: payment.invoiceNo },
                        RECORD_LOCALE,
                    ),
                    evidence: `${renewal.previousEndsOn} → ${renewal.contract.endsOn}`,
                },
                tx,
            )
        })
    }
}

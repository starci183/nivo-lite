import { Injectable } from "@nestjs/common"
import type { FactSpec, FactSubject, FactValues, GraphFactReader } from "@modules/domain/agent-graphs"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"

/** The fact the action graph reads for the confirmation of a supplier payment: what the bank says left the account. */
export const SUPPLIER_PAYMENT_AMOUNT = "supplier_payment.amount_vnd"

/** The action whose work item carries the reference of the outgoing payment. */
const CONFIRM_SUPPLIER_PAYMENT = "confirm_supplier_payment"

/** How far back before the question the outgoing payments are looked up. */
const DEBIT_WINDOW_DAYS = 60
const DAY_MS = 86_400_000

const AMOUNT: FactSpec = {
    key: SUPPLIER_PAYMENT_AMOUNT,
    type: "number",
    unit: "vnd",
    labelKey: "agentGraphs.fact.supplier_payment.amount_vnd",
}

@Injectable()
/**
 * Reads, for the action graph, the amount of the outgoing payment a supplier-payment question is about, from the payment itself as the
 * connector reports it and never from the amount the model wrote on the proposal. It finds the payment by the reference the question
 * kept; when the question, the reference or the payment cannot be found, the fact is absent and the branch falls to its else.
 */
export class AccountingFactReaderService implements GraphFactReader {
    /** The one fact it reads: the amount of the outgoing payment, in dong. */
    readonly facts: ReadonlyArray<FactSpec> = [AMOUNT]

    constructor(
        private readonly items: WorkItemsService,
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
    ) {}

    /** Reads the amount of the payment the work item of the subject names. */
    async read(workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<FactValues> {
        if (!facts.includes(SUPPLIER_PAYMENT_AMOUNT)) return {}
        const [item] = await this.items.findMany([subject.workItemId], 1)
        const debitRef = item?.proposal.fields.debit_ref
        if (
            item?.workspace_id !== workspaceId ||
            item.action !== CONFIRM_SUPPLIER_PAYMENT ||
            typeof debitRef !== "string"
        )
            return {}
        const since = new Date(Date.parse(item.created_at) - DEBIT_WINDOW_DAYS * DAY_MS).toISOString()
        const debits = await this.gateway.listPaymentDebits(workspaceId, since)
        const debit = debits.value.find((entry) => entry.creditRef === debitRef)
        return debit === undefined ? {} : { [SUPPLIER_PAYMENT_AMOUNT]: debit.amountVnd }
    }
}

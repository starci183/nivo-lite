import { Injectable } from "@nestjs/common"
import type { HubCardPayload } from "./accounting-desk.contracts"
import { AccountingRoomService } from "./accounting-room.service"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway, FolioMatch, FolioSnapshot } from "./accounting-gateway.port"
import { matchFolio, transferCodeOf } from "./folio-match.policy"
import { CARD_COPY, FOLIO_COPY, folioMatchText } from "./messages/accounting-desk.messages"

/** A bank credit as the folio reconciliation reads it. */
export interface BankCredit {
    /** The bank transaction reference (SePay id). */
    readonly bankTxnRef: string
    /** The transfer content. */
    readonly content: string
    /** The amount, VND. */
    readonly amountVnd: number
}

/** A folio match other than an exact payment. */
export type FolioMismatch = Exclude<FolioMatch, "exact">

/** What happened to one credit. */
export interface FolioOutcome {
    /** `no_code`, `unknown_folio`, `recorded`, `record_failed` or `mismatch`. */
    readonly kind: "no_code" | "unknown_folio" | "recorded" | "record_failed" | "mismatch"
    /** How the amount differed, for a mismatch. */
    readonly match?: FolioMismatch
}

const mismatchCard = (folio: FolioSnapshot, credit: BankCredit, match: FolioMismatch): HubCardPayload => ({
    v: 1,
    type: "exception",
    title: FOLIO_COPY.title(folio.roomNumber),
    badge: folioMatchText(match),
    body: FOLIO_COPY.body,
    fields: [
        { label: FOLIO_COPY.received, value: CARD_COPY.money(credit.amountVnd) },
        { label: FOLIO_COPY.balance, value: CARD_COPY.money(folio.balanceVnd) },
        { label: FOLIO_COPY.memo, value: folio.transferRef },
    ],
    data: {
        folioId: folio.folioId,
        stayId: folio.stayId,
        bankTxnRef: credit.bankTxnRef,
        sources: ["mcp:sepay.transactions.list", "mcp:hakuen.folio.get"],
    },
})

@Injectable()
/**
 * N23: a bank credit whose memo carries a HAKUEN folio transfer reference is matched against that folio through the MCP gateway.
 * An exact payment of the balance is recorded with `folio.recordPayment` and reported in the accounting room; any other amount
 * is raised as an exception card for the chief accountant and nothing is recorded.
 */
export class FolioReconcileService {
    constructor(
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly room: AccountingRoomService,
    ) {}

    /** Matches one credit; a credit without a folio memo or with an unknown memo is left to the existing reconciliation. */
    async reconcile(workspaceId: string, credit: BankCredit): Promise<FolioOutcome> {
        const transferRef = transferCodeOf(credit.content)
        if (transferRef === null) return { kind: "no_code" }
        const folio = await this.gateway.findByTransferRef(workspaceId, transferRef)
        if (folio === null) return { kind: "unknown_folio" }
        const match = matchFolio(folio, credit.amountVnd)
        if (match !== "exact") {
            const text = FOLIO_COPY.text(folio.roomNumber, credit.amountVnd, folio.balanceVnd)
            await this.room.postCard(workspaceId, mismatchCard(folio, credit, match), text)
            return { kind: "mismatch", match }
        }
        const payment = { folioId: folio.folioId, bankTxnRef: credit.bankTxnRef, amountVnd: credit.amountVnd }
        const recorded = await this.gateway.recordPayment(workspaceId, payment)
        await this.room.post(
            workspaceId,
            recorded
                ? FOLIO_COPY.recorded(folio.roomNumber, folio.guestName, credit.amountVnd, credit.bankTxnRef)
                : FOLIO_COPY.failed(folio.roomNumber, credit.bankTxnRef),
        )
        return { kind: recorded ? "recorded" : "record_failed" }
    }
}

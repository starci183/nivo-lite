import type { OrderRecord, TransactionRecord } from "./accounting.types"
import { ORDER, TRANSACTION, orderOf, transactionOf } from "./accounting.fixtures"

/** When the payment code of the order was issued: the instant the re-match counts its window back from. */
export const CODE_ISSUED_AT = "2026-11-06T09:00:00.000Z"

/** The order a payment code was just issued for: 5,000 VND, waiting for money. */
export const REMATCH_ORDER: OrderRecord = orderOf({
    id: "00000000-0000-4000-8000-0000000000b6",
    orderNo: "DH-20261106-0001",
    amountVnd: 5_000,
})

/** Words of a transfer content in each language the customers write in, each naming the code of the order. */
export const CONTENT_BY_LOCALE: Readonly<Record<"vi" | "en", string>> = {
    vi: "NGUYEN VAN A chuyen tien DH202611060001",
    en: "NGUYEN VAN A payment for DH202611060001",
}

/** A credit that arrived before the code existed: it names the code with exactly the amount due. */
export const CREDIT_BEFORE_CODE: TransactionRecord = transactionOf({
    id: "00000000-0000-4000-8000-000000095958",
    amountVnd: 5_000,
    reference: CONTENT_BY_LOCALE.vi,
    occurredAt: "2026-11-05T14:00:00.000Z",
    status: "unmatched",
})

/** A credit that names the code with another amount: a partial payment. */
export const CREDIT_PARTIAL: TransactionRecord = transactionOf({
    id: "00000000-0000-4000-8000-000000095937",
    amountVnd: 2_000,
    reference: CONTENT_BY_LOCALE.en,
    occurredAt: "2026-11-05T15:00:00.000Z",
    status: "unmatched",
})

/** A credit that names no code at all. */
export const CREDIT_NO_CODE: TransactionRecord = transactionOf({
    id: "00000000-0000-4000-8000-000000095940",
    amountVnd: 5_000,
    reference: "chuyen tien an trua",
    occurredAt: "2026-11-05T16:00:00.000Z",
    status: "unmatched",
})

/** The big order of the older fixtures, untouched by the code of the new one. */
export const OTHER_ORDER: OrderRecord = ORDER

/** A credit of the older fixtures, unmatched, with a code of another order. */
export const CREDIT_OTHER_ORDER: TransactionRecord = TRANSACTION

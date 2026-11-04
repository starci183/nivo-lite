import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { OrdersService } from "@modules/domain/orders"
import { answerQueryBuilders, fakeQueryBuilder } from "./fake-query-builder.builder"
import type { FakeQueryBuilder } from "./fake-query-builder.builder"

type NewOrderDraft = Parameters<OrdersService["draft"]>[0]
type OrderConfirmation = Parameters<OrdersService["confirm"]>[0]

/** The instant the orders service spec runs at. */
export const NOW = "2026-10-13T02:00:00.000Z"

/** A new draft order as the service takes it. */
export const draftOf: (overrides?: Partial<NewOrderDraft>) => NewOrderDraft = builder<NewOrderDraft>({
    workspaceId: "ws-1",
    leadId: "lead-1",
    inboundEventId: "event-1",
    orderNo: null,
    items: "2 x Tea",
    amountVnd: 90000,
})

/** A confirmation as the service takes it. */
export const confirmationOf: (overrides?: Partial<OrderConfirmation>) => OrderConfirmation = builder<OrderConfirmation>(
    {
        workspaceId: "ws-1",
        orderId: "order-1",
        amountVnd: 90000,
        items: "2 x Tea",
        confirmedBy: "Lan",
    },
)

/** Makes the successive query builders of `em` each answer a write with the given `RETURNING` rows. */
export const answerWrites = (
    em: MockEntityManager,
    ...answers: Array<ReadonlyArray<unknown>>
): Array<FakeQueryBuilder> => {
    const builders = answers.map((raw) => fakeQueryBuilder({ execute: { raw } }))
    answerQueryBuilders(em, ...builders)
    return builders
}

/** An entity manager and the query builders that answer its writes. */
export interface WritingWorld {
    readonly em: MockEntityManager
    readonly builders: Array<FakeQueryBuilder>
}

/** A fresh entity manager answering writes like {@link answerWrites}. */
export const writing = (...answers: Array<ReadonlyArray<unknown>>): WritingWorld => {
    const em = mockEntityManager()
    return { em, builders: answerWrites(em, ...answers) }
}

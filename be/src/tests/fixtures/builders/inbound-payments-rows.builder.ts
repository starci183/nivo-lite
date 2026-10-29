import { inboundEventsEntities } from "@modules/domain/inbound-events"

const [InboundEventEntity] = inboundEventsEntities

/** A payment of 500000 VND from Lan that still waits for a decision. */
export const waitingPaymentRow = (): InstanceType<typeof InboundEventEntity> =>
    Object.assign(new InboundEventEntity(), {
        amountVnd: 500000,
        senderName: "Lan",
        externalRef: null,
        body: "chuyen khoan",
    })

/** A waiting payment from Lan that carries no amount and the bank reference `FT123`. */
export const waitingPaymentWithoutAmountRow = (): InstanceType<typeof InboundEventEntity> =>
    Object.assign(waitingPaymentRow(), { amountVnd: null, externalRef: "FT123" })

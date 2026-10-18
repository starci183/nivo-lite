import type { SalesShipment, SalesShipmentRequest } from "@modules/domain/sales"
import type { Locale } from "@modules/platform/i18n"
import type { MarkOrderShippedInput } from "./dto/mark-order-shipped.input"
import type { MarkOrderShippedType } from "./dto/mark-order-shipped.type"

/** Adds the authenticated workspace and accepted locale to the bounded input. */
export const toMarkOrderShippedRequest = (
    workspaceId: string,
    locale: Locale,
    input: MarkOrderShippedInput,
): SalesShipmentRequest => ({
    workspaceId,
    locale,
    orderId: input.orderId,
    carrier: input.carrier,
    trackingCode: input.trackingCode,
})

/** Maps the domain result to the GraphQL contract. */
export const toMarkOrderShippedType = (result: SalesShipment): MarkOrderShippedType => ({
    id: result.id,
    orderNo: result.orderNo,
    notificationId: result.notificationId,
})

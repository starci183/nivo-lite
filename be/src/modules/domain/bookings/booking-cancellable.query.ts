import { BookingServicesReadService } from "@modules/domain/booking-services"
import type { OptionalCancellableBooking } from "./booking-chat.contracts"
import type { CancellableRowFacts } from "./booking-facts.contracts"
import { cancellableOf } from "./policies/cancellable.policy"

/** The booking a customer may cancel, named with the current name of its service; none for no row or when the service is gone. */
export const cancellableNamed = async (
    services: BookingServicesReadService,
    workspaceId: string,
    row: CancellableRowFacts | undefined,
): Promise<OptionalCancellableBooking> => {
    if (row === undefined) return null
    const names = await services.namesOf(workspaceId, [row.service_id])
    const name = names.get(row.service_id)
    return name === undefined ? null : cancellableOf({ ...row, service_name: name })
}

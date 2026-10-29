import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { BookingResourcesReadService } from "@modules/domain/booking-resources"
import type { BookingServicesReadService } from "@modules/domain/booking-services"
import type { EffectsBaseFacts, EffectsRow } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"

/** The booking of a workspace with its instants as epoch milliseconds, selected as `EffectsBaseFacts`; the caller adds a lock or a read. */
export const effectsQuery = (
    manager: EntityManager,
    workspaceId: string,
    bookingId: string,
): SelectQueryBuilder<BookingEntity> =>
    manager
        .createQueryBuilder(BookingEntity, "b")
        .select("b.id", "id")
        .addSelect("b.workspaceId", "workspace_id")
        .addSelect("b.status", "status")
        .addSelect("b.leadId", "lead_id")
        .addSelect("b.conversationId", "conversation_id")
        .addSelect("b.customerName", "customer_name")
        .addSelect("b.customerPhone", "customer_phone")
        .addSelect("b.customerEmail", "customer_email")
        .addSelect("b.cancelReason", "cancel_reason")
        .addSelect("b.rescheduleCount", "reschedule_count")
        .addSelect("b.holdsSlot", "holds_slot")
        .addSelect("b.serviceId", "service_id")
        .addSelect("b.resourceId", "resource_id")
        .addSelect("CAST(b.priceVnd AS float8)", "price_vnd")
        .addSelect("CAST(b.cancelFeeVnd AS float8)", "cancel_fee_vnd")
        .addSelect("CAST(b.depositVnd AS float8)", "deposit_vnd")
        .addSelect("CAST(extract(epoch FROM b.startAt) * 1000 AS float8)", "start_ms")
        .addSelect("CAST(extract(epoch FROM b.cancelledAt) * 1000 AS float8)", "cancelled_ms")
        .addSelect("CAST(extract(epoch FROM b.rescheduledFrom) * 1000 AS float8)", "from_ms")
        .where("b.workspaceId = :workspaceId AND b.id = :bookingId", { workspaceId, bookingId })
        .limit(1)

/** The booking with the current names of its service and resource; none when its service is gone, an empty resource name when its resource is. */
export const effectsNamed = async (
    services: BookingServicesReadService,
    resources: BookingResourcesReadService,
    base: EffectsBaseFacts,
): Promise<EffectsRow | null> => {
    const { service_id: serviceId, resource_id: resourceId, ...rest } = base
    const [serviceNames, resourceNames] = await Promise.all([
        services.namesOf(base.workspace_id, [serviceId]),
        resources.namesOf(base.workspace_id, [resourceId]),
    ])
    const serviceName = serviceNames.get(serviceId)
    if (serviceName === undefined) return null
    return { ...rest, service_name: serviceName, resource_name: resourceNames.get(resourceId) ?? "" }
}

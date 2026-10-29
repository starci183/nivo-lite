import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { BookingResourceEntity } from "@modules/domain/booking-resources"
import { BookingServiceEntity } from "@modules/domain/booking-services"
import { BookingEntity } from "./persistence/entities"

/** The booking of a workspace with its service and resource names and its instants as epoch milliseconds, selected as `EffectsRow`; the caller adds a lock or a read. */
export const effectsQuery = (
    manager: EntityManager,
    workspaceId: string,
    bookingId: string,
): SelectQueryBuilder<BookingEntity> =>
    manager
        .createQueryBuilder(BookingEntity, "b")
        .innerJoin(BookingServiceEntity, "s", "s.id = b.serviceId")
        .leftJoin(BookingResourceEntity, "r", "r.id = b.resourceId")
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
        .addSelect("s.name", "service_name")
        .addSelect("COALESCE(r.name, '')", "resource_name")
        .addSelect("CAST(b.priceVnd AS float8)", "price_vnd")
        .addSelect("CAST(b.cancelFeeVnd AS float8)", "cancel_fee_vnd")
        .addSelect("CAST(b.depositVnd AS float8)", "deposit_vnd")
        .addSelect("CAST(extract(epoch FROM b.startAt) * 1000 AS float8)", "start_ms")
        .addSelect("CAST(extract(epoch FROM b.cancelledAt) * 1000 AS float8)", "cancelled_ms")
        .addSelect("CAST(extract(epoch FROM b.rescheduledFrom) * 1000 AS float8)", "from_ms")
        .where("b.workspaceId = :workspaceId AND b.id = :bookingId", { workspaceId, bookingId })
        .limit(1)

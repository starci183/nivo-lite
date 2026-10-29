import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BookingServiceEntity } from "@modules/domain/booking-services"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatBookingRef, OptionalCancellableBooking } from "./booking-chat.contracts"
import type { CancellableFacts } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"
import { cancellableOf } from "./policies/cancellable.policy"

@Injectable()
/** Finds the booking a customer talks about in a chat: the next open one of the chat's lead, else of the conversation it was booked in. */
export class BookingChatLookupService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The next open booking of a chat that has not started yet, or none. */
    async nextOfChat(chat: ChatBookingRef, nowMs: number): Promise<OptionalCancellableBooking> {
        const row = await this.entityManager
            .createQueryBuilder(BookingEntity, "b")
            .innerJoin(BookingServiceEntity, "s", "s.id = b.serviceId AND s.workspaceId = b.workspaceId")
            .select("b.id", "id")
            .addSelect("b.leadId", "lead_id")
            .addSelect("b.customerName", "customer_name")
            .addSelect("s.name", "service_name")
            .addSelect("CAST(extract(epoch FROM b.startAt) * 1000 AS float8)", "start_ms")
            .where("b.workspaceId = :workspaceId", { workspaceId: chat.workspaceId })
            .andWhere("((b.leadId IS NOT NULL AND b.leadId = :leadId) OR b.conversationId = :conversationId)", {
                leadId: chat.leadId,
                conversationId: chat.conversationId,
            })
            .andWhere("b.status IN ('requested', 'confirmed') AND b.checkedInAt IS NULL")
            .andWhere("b.startAt > :now", { now: new Date(nowMs) })
            .orderBy("b.startAt", "ASC")
            .addOrderBy("b.id", "ASC")
            .limit(1)
            .getRawOne<CancellableFacts>()
        return cancellableOf(row)
    }
}

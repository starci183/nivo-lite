import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ChatBookingRef,
    OptionalCancellableBooking,
    OptionalBookingInstallationId,
} from "./booking-chat.contracts"
import type { CancellableRowFacts } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"
import { cancellableOf } from "./policies/cancellable.policy"

@Injectable()
/** Finds the booking a customer talks about in a chat: the next open one of the chat's lead, else of the conversation it was booked in. */
export class BookingChatLookupService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly services: BookingServicesReadService,
    ) {}

    /** The installation that owns a booking of the workspace; null when there is no such row or it names no installation. */
    async installationIdOf(workspaceId: string, id: string): Promise<OptionalBookingInstallationId> {
        const row = await this.entityManager.findOne(BookingEntity, {
            select: { installationId: true },
            where: { workspaceId, id },
        })
        return row?.installationId ?? null
    }

    /** The next open booking of a chat that has not started yet, or none. */
    async nextOfChat(chat: ChatBookingRef, nowMs: number): Promise<OptionalCancellableBooking> {
        const row = await this.entityManager
            .createQueryBuilder(BookingEntity, "b")
            .select("b.id", "id")
            .addSelect("b.leadId", "lead_id")
            .addSelect("b.customerName", "customer_name")
            .addSelect("b.serviceId", "service_id")
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
            .getRawOne<CancellableRowFacts>()
        return this.named(chat.workspaceId, row)
    }

    /** The booking named with the current name of its service; none for no row or when the service is gone. */
    private async named(
        workspaceId: string,
        row: CancellableRowFacts | undefined,
    ): Promise<OptionalCancellableBooking> {
        if (row === undefined) return null
        const names = await this.services.namesOf(workspaceId, [row.service_id])
        const name = names.get(row.service_id)
        return name === undefined ? null : cancellableOf({ ...row, service_name: name })
    }
}

import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatBookingRef, OptionalCancellableBooking } from "./booking-chat.contracts"
import { SELECT_NEXT_CHAT_BOOKING } from "./persistence/booking-write.sql"
import type { CancellableBookingRow } from "./persistence/booking.rows"
import { cancellableOf } from "./policies/cancellable.policy"
import { bookingIsoOf } from "./policies/zoned-time.policy"

@Injectable()
/** Finds the booking a customer talks about in a chat: the next open one of the chat's lead, else of the conversation it was booked in. */
export class BookingChatLookupService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The next open booking of a chat that has not started yet, or none. */
    async nextOfChat(chat: ChatBookingRef, nowMs: number): Promise<OptionalCancellableBooking> {
        const [row] = await this.entityManager.query<Array<CancellableBookingRow>>(SELECT_NEXT_CHAT_BOOKING, [
            chat.workspaceId,
            chat.leadId,
            chat.conversationId,
            bookingIsoOf(nowMs),
        ])
        return cancellableOf(row)
    }
}

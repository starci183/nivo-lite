import { Injectable } from "@nestjs/common"
import { BookingWaitlistService } from "@modules/domain/booking-waitlist"
import { BookingPublicService, bookingIsoOf, localDate, localHhmm, zonedMs } from "@modules/domain/bookings"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BookingChatChangesService } from "./booking-chat-changes.service"
import type { BookingChatAnswer, BookingChatTurn } from "./booking-chat.contracts"
import { normaliseBookingPhone, resolveBookingService } from "./booking-tool-args.policy"
import { addDayIso, offeredTimes, withinPeriod } from "./booking-chat.policy"

const LOCALE = "vi"
/** How many free times a reply offers. */
const OFFER_MAX = 5

@Injectable()
/**
 * The chatbot's door into booking: the chat reply of a booking agent (or of a chatbot that hands over to one) carries a structured
 * `booking_request`, and this runs it. Nothing here confirms, moves or cancels by itself: a new request is placed exactly like the public
 * booking page (held for the owner, or confirmed when the owner confirms by themselves), a change or a cancellation becomes a decision of
 * the owner's gate, and the words the customer reads come from fixed templates filled with facts from the calendar, never from the model.
 */
export class BookingChatService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly bookings: BookingPublicService,
        private readonly waitlist: BookingWaitlistService,
        private readonly changes: BookingChatChangesService,
    ) {}

    /** The [BOOKING DATA] block of a turn: today's local date and the services the agent may book, with their length and price. */
    async brief(workspaceId: string): Promise<string> {
        const catalog = await this.bookings.catalogIn(workspaceId)
        const today = localDate(this.clock.now().getTime(), catalog.timezone)
        const services = catalog.services.map((service) =>
            this.text("briefService", {
                name: service.name,
                minutes: String(service.durationMin),
                price: service.priceVnd === null ? "-" : String(service.priceVnd),
            }),
        )
        return [this.text("briefHeader", { today, zone: catalog.timezone }), ...services].join("\n")
    }

    /** Runs one booking request of a chat turn; a request repeated for the same message changes nothing twice. */
    async apply(turn: BookingChatTurn): Promise<BookingChatAnswer> {
        const { request } = turn
        if (request.intent === "cancel" || request.intent === "reschedule") return this.changes.apply(turn)
        const catalog = await this.bookings.catalogIn(turn.workspaceId)
        const service = resolveBookingService(catalog.services, request.service)
        if (service === undefined) {
            const names = catalog.services.map((entry) => entry.name).join(", ")
            return this.say("askService", { services: names === "" ? "-" : names })
        }
        if (request.date === null) return this.say("askDate", { service: service.name })
        const zone = catalog.timezone
        const { times } = await this.bookings.freeTimesIn({
            workspaceId: turn.workspaceId,
            service: service.id,
            date: request.date,
            party: request.partySize,
        })
        if (request.intent === "waitlist") return this.joinWaitlist(turn, service.id, service.name, zone)
        if (request.intent === "availability" || request.time === null) {
            const offered = offeredTimes(
                times.filter((iso) => withinPeriod(localHhmm(Date.parse(iso), zone), request.from, request.to)),
                zone,
                OFFER_MAX,
            )
            return offered === ""
                ? this.say("noTimes", { service: service.name, date: request.date })
                : this.say("offerTimes", { service: service.name, date: request.date, times: offered })
        }
        const phone = request.phone === null ? null : normaliseBookingPhone(request.phone)
        const name = request.name === "" ? turn.visitorName : request.name
        if (name === "" || phone === null) return this.say("askContact", { service: service.name })
        const start = bookingIsoOf(zonedMs(request.date, request.time, zone))
        const result = await this.bookings.requestIn({
            workspaceId: turn.workspaceId,
            sourceChannel: "chat",
            serviceId: service.id,
            start,
            name,
            phone,
            email: request.email ?? "",
            party: request.partySize,
            note: request.note ?? "",
            token: `chat:${turn.messageId}:${start}`,
            conversationId: turn.conversationId,
            leadId: turn.leadId,
        })
        if (result.state === "confirmed") return { reply: null, state: "confirmed" }
        if (result.state === "waiting" && result.code === "received_free")
            return this.say("requestHeld", { service: service.name })
        if (result.state === "waiting") {
            const offered = offeredTimes(result.alternatives, zone, OFFER_MAX)
            return offered === ""
                ? this.say("requestTaken", { service: service.name })
                : this.say("requestTakenOffer", { service: service.name, times: offered })
        }
        return this.say("requestInvalid", { service: service.name })
    }

    private async joinWaitlist(
        turn: BookingChatTurn,
        serviceId: string,
        serviceName: string,
        zone: string,
    ): Promise<BookingChatAnswer> {
        const { request } = turn
        const date = request.date ?? ""
        const windowStart = bookingIsoOf(zonedMs(date, request.from ?? "00:00", zone))
        const windowEnd =
            request.to === null
                ? addDayIso(bookingIsoOf(zonedMs(date, "00:00", zone)))
                : bookingIsoOf(zonedMs(date, request.to, zone))
        await this.waitlist.join({
            workspaceId: turn.workspaceId,
            leadId: turn.leadId,
            conversationId: turn.conversationId,
            customerName: request.name === "" ? turn.visitorName : request.name,
            customerPhone: request.phone === null ? null : normaliseBookingPhone(request.phone),
            serviceId,
            windowStart,
            windowEnd,
            partySize: request.partySize,
            note: request.note ?? "",
        })
        return this.say("waitlisted", { service: serviceName, date })
    }

    private say(key: string, params: Readonly<Record<string, string>> = {}): BookingChatAnswer {
        return { reply: this.text(key, params), state: key }
    }

    private text(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(`performers.chatBooking.${key}`, params, LOCALE)
    }
}

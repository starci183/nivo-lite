import { Injectable } from "@nestjs/common"
import type {
    BookingCancelArgs,
    BookingFindSlotsArgs,
    BookingRequestArgs,
    BookingRequestInvalidCode,
    BookingToolName,
    BookingTools,
    JsonResult,
    ToolArgs,
    ToolContext,
} from "@modules/domain/agent-tools"
import { BookingPublicService } from "@modules/domain/bookings"
import { WorkEngineService } from "@modules/domain/decisions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import {
    bookingDateIn,
    isPlausibleBookingPhone,
    normaliseBookingPhone,
    readBookingCancelArgs,
    readBookingFindSlotsArgs,
    readBookingRequestArgs,
    resolveBookingService,
} from "./booking-tool-args.policy"

const TOOL_TIMES_MAX = 20
const ENGINE_ACTOR = "NIVO engine"

@Injectable()
/** Serves booking facts in a customer's chat and sends cancellation requests through the owner's decision gate. */
export class BookingToolsService implements BookingTools {
    constructor(
        private readonly bookings: BookingPublicService,
        private readonly engine: WorkEngineService,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Runs a booking tool within the verified job's workspace and conversation. */
    run(ctx: ToolContext, tool: BookingToolName, args: ToolArgs): Promise<JsonResult> {
        switch (tool) {
            case "booking.find_slots":
                return this.findSlots(ctx, readBookingFindSlotsArgs(args))
            case "booking.request":
                return this.request(ctx, readBookingRequestArgs(args))
            case "booking.cancel":
                return this.cancel(ctx, readBookingCancelArgs(args))
        }
    }

    private async findSlots(ctx: ToolContext, args: BookingFindSlotsArgs): Promise<JsonResult> {
        const catalog = await this.bookings.catalogIn(ctx.workspaceId)
        const service = resolveBookingService(catalog.services, args.service)
        if (service === undefined)
            return {
                ok: false,
                reason: "service_unknown",
                services: catalog.services.filter((entry) => entry.active).map((entry) => entry.name),
            }
        const timezone = catalog.timezone
        const date = args.date ?? bookingDateIn(this.clock.now().getTime(), timezone)
        const { times } = await this.bookings.freeTimesIn({
            workspaceId: ctx.workspaceId,
            service: service.id,
            date,
            party: args.party,
        })
        return { ok: true, service: service.name, timezone, date, times: [...new Set(times)].slice(0, TOOL_TIMES_MAX) }
    }

    private async request(ctx: ToolContext, args: BookingRequestArgs): Promise<JsonResult> {
        if (args.name === "") return this.invalid("name_required")
        if (!isPlausibleBookingPhone(normaliseBookingPhone(args.phone))) return this.invalid("phone_invalid")
        if (args.start === "" || !Number.isFinite(Date.parse(args.start))) return this.invalid("start_invalid")
        const catalog = await this.bookings.catalogIn(ctx.workspaceId)
        const service = resolveBookingService(catalog.services, args.service)
        if (service === undefined)
            return {
                ...this.invalid("service_unavailable"),
                services: catalog.services.filter((entry) => entry.active).map((entry) => entry.name),
            }
        const result = await this.bookings.requestIn({
            workspaceId: ctx.workspaceId,
            sourceChannel: "chat",
            serviceId: service.id,
            start: args.start,
            name: args.name,
            phone: args.phone,
            email: "",
            party: args.party,
            note: args.note,
            token: `chat:${ctx.jobId}:${args.start}`,
        })
        return {
            ok: result.ok,
            state: result.state,
            code: result.code,
            service: result.serviceName,
            start: result.startIso,
            alternatives: result.alternatives,
            bookingId: result.bookingId,
        }
    }

    private async cancel(ctx: ToolContext, args: BookingCancelArgs): Promise<JsonResult> {
        const phone = normaliseBookingPhone(args.phone)
        if (!isPlausibleBookingPhone(phone)) return { ok: false, reason: "not_found" }
        const booking = await this.bookings.nextCancellable(ctx.workspaceId, phone, this.clock.now().getTime())
        if (booking === null) return { ok: false, reason: "not_found" }
        await this.engine.runWork(
            { workspaceId: ctx.workspaceId, actor: ENGINE_ACTOR, locale: "vi" },
            {
                action: "cancel_booking",
                subject_type: booking.leadId === null ? "conversation" : "lead",
                subject_id: booking.leadId ?? ctx.conversationId,
                preset: true,
                noChain: true,
                forceAsk: "unclear_outcome",
                dedupeKey: `cancel_booking:booking:${booking.id}`,
                seed: {
                    summary: this.catalog.get(
                        "performers.cancelBookingSummary",
                        { service: booking.serviceName, name: booking.customerName, start: booking.startIso },
                        "vi",
                    ),
                    fields: {
                        booking_id: booking.id,
                        start_at: booking.startIso,
                        service: booking.serviceName,
                        customer_name: booking.customerName,
                        reason: args.reason,
                        conversation_id: ctx.conversationId,
                    },
                },
            },
        )
        return { ok: true, state: "waiting", start: booking.startIso, service: booking.serviceName }
    }

    private invalid(code: BookingRequestInvalidCode): JsonResult {
        return { ok: false, state: "invalid", code, service: "", start: "", alternatives: [], bookingId: null }
    }
}

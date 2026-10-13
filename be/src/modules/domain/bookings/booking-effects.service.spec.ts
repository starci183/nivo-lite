import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BookingEffectsService } from "./booking-effects.service"
import { BookingModelService } from "./booking-model.service"
import type { BookingEffects, BookingEvent, BookingNotifier, BookingSettings } from "./bookings.contracts"
import { BOOKINGS_NOTIFIER } from "./bookings.decorators"
import {
    CLAIM_EFFECT,
    RELEASE_EFFECT,
    SELECT_BOOKING_FOR_EFFECTS,
    SET_BOOKING_FEE,
} from "./persistence/booking-effects.sql"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"
import type { EffectsRow } from "./persistence/booking.rows"

const WORKSPACE = "ws-1"
const BOOKING_ID = "b1"
const NOW = Date.UTC(2026, 9, 14, 5)
const START = Date.UTC(2026, 9, 15, 2, 30)
const HOUR = 3_600_000
const CLAIMED = [CLAIM_EFFECT, [{ id: BOOKING_ID }]] as const
const ALREADY_CLAIMED = [CLAIM_EFFECT, []] as const
const NO_EFFECTS: BookingEffects = { found: false, reminders: "none", feeVnd: 0, handedOff: false, notified: false }
const effectsOf = builder<BookingEffects>({ ...NO_EFFECTS, found: true })
const eventOf = builder<BookingEvent>({ workspaceId: WORKSPACE, bookingId: BOOKING_ID, kind: "status" })
const settingsOf = builder<BookingSettings>(DEFAULT_SETTINGS)
const rowOf = builder<EffectsRow>({
    id: BOOKING_ID,
    status: "confirmed",
    lead_id: "lead-1",
    conversation_id: "conversation-1",
    customer_name: "Mai",
    customer_phone: "84912345678",
    customer_email: "mai@example.com",
    origin: "live",
    cancel_reason: null,
    reschedule_count: 0,
    service_name: "Cut",
    price_vnd: 200000,
    cancel_fee_vnd: 0,
    start_ms: START,
    cancelled_ms: null,
})
const build = async (stubs: ReadonlyArray<readonly [string, unknown]> = [], settings = settingsOf()) => {
    const tx = fakeTransaction(mockEntityManager({ query: stubs }))
    const models = mock<BookingModelService>()
    models.settings.mockResolvedValue(settings)
    const reminders = mock<BookingRemindersService>()
    reminders.schedule.mockResolvedValue([])
    reminders.cancel.mockResolvedValue(undefined)
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const inbound = mock<InboundEventsService>()
    inbound.handOffOrder.mockResolvedValue(true)
    const notifier = mock<BookingNotifier>()
    notifier.notify.mockResolvedValue(true)
    const messages = mock<MessageCatalog>()
    messages.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingEffectsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: BOOKINGS_NOTIFIER, useValue: notifier },
            { provide: BookingModelService, useValue: models },
            { provide: BookingRemindersService, useValue: reminders },
            { provide: EventsService, useValue: events },
            { provide: InboundEventsService, useValue: inbound },
        ],
    }).compile()
    return { service: moduleRef.get(BookingEffectsService), tx, models, reminders, events, inbound, notifier, messages }
}

describe("BookingEffectsService", () => {
    it.each([
        { workspaceId: "", bookingId: BOOKING_ID },
        { workspaceId: WORKSPACE, bookingId: "" },
        { workspaceId: "", bookingId: "" },
    ])("returns no effects before doing any work for empty ids: %j", async (ids) => {
        const { service, tx, models, reminders, events, inbound, notifier, messages } = await build()

        await expect(service.apply(eventOf(ids))).resolves.toEqual(NO_EFFECTS)

        expect(models.settings).not.toHaveBeenCalled()
        expect(tx.em.transaction).not.toHaveBeenCalled()
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(reminders.schedule).not.toHaveBeenCalled()
        expect(reminders.cancel).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(inbound.handOffOrder).not.toHaveBeenCalled()
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(messages.get).not.toHaveBeenCalled()
    })

    it("returns no effects when the booking no longer exists", async () => {
        const { service, tx, models, reminders, notifier, events, inbound } = await build([
            [SELECT_BOOKING_FOR_EFFECTS, []],
        ])

        await expect(service.apply(eventOf())).resolves.toEqual(NO_EFFECTS)

        expect(models.settings.mock.calls).toEqual([[WORKSPACE]])
        expect(tx.em.query.mock.calls).toEqual([[SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]]])
        expect(tx.outcomes).toEqual(["commit"])
        expect(reminders.schedule).not.toHaveBeenCalled()
        expect(reminders.cancel).not.toHaveBeenCalled()
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(inbound.handOffOrder).not.toHaveBeenCalled()
    })

    it("leaves a requested booking without reminders, fees, evidence or a notice", async () => {
        const { service, tx, reminders, notifier, events, messages, inbound } = await build([
            [SELECT_BOOKING_FOR_EFFECTS, [rowOf({ status: "requested", cancel_fee_vnd: 1000 })]],
        ])

        await expect(service.apply(eventOf({ kind: "created" }))).resolves.toEqual(effectsOf())

        expect(tx.em.query.mock.calls).toEqual([[SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]]])
        expect(reminders.schedule).not.toHaveBeenCalled()
        expect(reminders.cancel).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(messages.get).not.toHaveBeenCalled()
        expect(inbound.handOffOrder).not.toHaveBeenCalled()
    })

    it.each([
        {
            status: "confirmed",
            kind: "status",
            count: 0,
            timezone: "Asia/Ho_Chi_Minh",
            hours: [24, 2],
            notice: "confirmed",
            mark: "notice:confirmed",
            when: "09:30 2026-10-15",
            delivered: true,
        },
        {
            status: "rescheduled",
            kind: "moved",
            count: 3,
            timezone: "UTC",
            hours: [12, 1],
            notice: "moved",
            mark: "notice:moved:3",
            when: "02:30 2026-10-15",
            delivered: false,
        },
    ] as const)("plans $status reminders and handles a delivered=$delivered notice after commit", async (test) => {
        const { service, tx, reminders, notifier, messages, events, inbound } = await build(
            [
                [SELECT_BOOKING_FOR_EFFECTS, [rowOf({ status: test.status, reschedule_count: test.count })]],
                CLAIMED,
                [RELEASE_EFFECT, []],
            ],
            settingsOf({ timezone: test.timezone, reminderHours: test.hours }),
        )
        notifier.notify.mockImplementation(() => {
            expect(tx.outcomes).toEqual(["commit"])
            return Promise.resolve(test.delivered)
        })

        await expect(service.apply(eventOf({ kind: test.kind }))).resolves.toEqual(
            effectsOf({ reminders: "planned", notified: test.delivered }),
        )

        const manager = reminders.schedule.mock.calls[0]?.[0].manager
        expect(isTransactionManager(manager)).toBe(true)
        expect(reminders.schedule.mock.calls).toEqual([
            [
                {
                    manager,
                    workspaceId: WORKSPACE,
                    bookingId: BOOKING_ID,
                    startMs: START,
                    nowMs: NOW,
                    defaultHours: test.hours,
                },
            ],
        ])
        expect(tx.em.query.mock.calls).toEqual([
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, test.mark]],
            ...(!test.delivered ? [[RELEASE_EFFECT, [WORKSPACE, BOOKING_ID, test.mark]]] : []),
        ])
        expect(messages.get.mock.calls).toEqual([
            [`bookings.notice.${test.notice}`, { service: "Cut", when: test.when }, "vi"],
        ])
        expect(notifier.notify.mock.calls).toEqual([
            [
                {
                    workspaceId: WORKSPACE,
                    conversationId: "conversation-1",
                    text: `vi:bookings.notice.${test.notice}:{"service":"Cut","when":"${test.when}"}`,
                },
            ],
        ])
        expect(reminders.cancel).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(inbound.handOffOrder).not.toHaveBeenCalled()
    })

    it.each([true, false])("plans reminders without a notice when conversation exists=%s", async (conversation) => {
        const { service, tx, reminders, notifier, messages } = await build([
            [SELECT_BOOKING_FOR_EFFECTS, [rowOf({ conversation_id: conversation ? "conversation-1" : null })]],
            ALREADY_CLAIMED,
        ])

        await expect(service.apply(eventOf())).resolves.toEqual(effectsOf({ reminders: "planned" }))

        expect(reminders.schedule).toHaveBeenCalledTimes(1)
        expect(tx.em.query.mock.calls).toEqual([
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            ...(conversation ? [[CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, "notice:confirmed"]]] : []),
        ])
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(messages.get).not.toHaveBeenCalled()
    })

    it.each([
        { status: "cancelled", fee: 74000, recorded: 74000, previous: 0, changed: true },
        { status: "no_show", fee: 35000, recorded: 35000, previous: 0, changed: true },
        { status: "no_show", fee: 35000, recorded: 1700, previous: 1700, changed: false },
        { status: "cancelled", fee: 0, recorded: 1700, previous: 1700, changed: false },
        { status: "no_show", fee: 0, recorded: 1700, previous: 1700, changed: false },
        { status: "done", fee: 0, recorded: 1700, previous: 1700, changed: false },
    ])("stops $status reminders and retains or records fee $recorded (policy=$fee)", async (test) => {
        const { service, tx, reminders, events, messages, notifier, inbound } = await build(
            [
                [
                    SELECT_BOOKING_FOR_EFFECTS,
                    [
                        rowOf({
                            status: test.status,
                            conversation_id: null,
                            cancelled_ms: START - HOUR,
                            cancel_fee_vnd: test.previous,
                        }),
                    ],
                ],
                [SET_BOOKING_FEE, test.changed ? [{ id: BOOKING_ID }] : []],
                CLAIMED,
            ],
            settingsOf({
                cancelWindowHours: 2,
                lateCancelFeePct: test.fee === 0 ? 0 : 37,
                noShowFeeVnd: test.fee === 0 ? 0 : 35000,
            }),
        )

        await expect(service.apply(eventOf())).resolves.toEqual(
            effectsOf({ reminders: "stopped", feeVnd: test.recorded }),
        )

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(reminders.cancel.mock.calls).toEqual([[manager, BOOKING_ID, `booking_${test.status}`]])
        expect(reminders.schedule).not.toHaveBeenCalled()
        expect(tx.em.query.mock.calls).toEqual([
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            ...(test.fee > 0 ? [[SET_BOOKING_FEE, [WORKSPACE, BOOKING_ID, test.fee]]] : []),
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, `evidence:${test.status}`]],
        ])
        expect(events.record.mock.calls).toEqual([
            [
                {
                    workspaceId: WORKSPACE,
                    kind: `booking.${test.status}`,
                    actor: "vi:bookings.evidence.actor:{}",
                    summary: `vi:bookings.evidence.${test.status}:{"service":"Cut","customer":"Mai"}`,
                    leadId: "lead-1",
                },
                manager,
            ],
        ])
        expect(messages.get.mock.calls).toEqual([
            ["bookings.evidence.actor", {}, "vi"],
            [`bookings.evidence.${test.status}`, { service: "Cut", customer: "Mai" }, "vi"],
        ])
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(inbound.handOffOrder).not.toHaveBeenCalled()
    })

    it("records evidence once when the closed booking event is repeated", async () => {
        const { service, tx, reminders, events, messages } = await build([
            [SELECT_BOOKING_FOR_EFFECTS, [rowOf({ status: "done", conversation_id: null, lead_id: null })]],
            CLAIMED,
            ALREADY_CLAIMED,
        ])

        await expect(service.apply(eventOf())).resolves.toEqual(effectsOf({ reminders: "stopped" }))
        await expect(service.apply(eventOf())).resolves.toEqual(effectsOf({ reminders: "stopped" }))

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(events.record.mock.calls).toEqual([
            [
                {
                    workspaceId: WORKSPACE,
                    kind: "booking.done",
                    actor: "vi:bookings.evidence.actor:{}",
                    summary: 'vi:bookings.evidence.done:{"service":"Cut","customer":"Mai"}',
                    leadId: null,
                },
                manager,
            ],
        ])
        expect(messages.get.mock.calls).toEqual([
            ["bookings.evidence.actor", {}, "vi"],
            ["bookings.evidence.done", { service: "Cut", customer: "Mai" }, "vi"],
        ])
        expect(tx.em.query.mock.calls).toEqual([
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, "evidence:done"]],
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, "evidence:done"]],
        ])
        expect(tx.outcomes).toEqual(["commit", "commit"])
    })

    it("tells the customer about a cancellation whose evidence was already recorded", async () => {
        const { service, tx, reminders, notifier, messages, events } = await build([
            [SELECT_BOOKING_FOR_EFFECTS, [rowOf({ status: "cancelled" })]],
            ALREADY_CLAIMED,
            CLAIMED,
        ])

        await expect(service.apply(eventOf())).resolves.toEqual(effectsOf({ reminders: "stopped", notified: true }))

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(reminders.cancel.mock.calls).toEqual([[manager, BOOKING_ID, "booking_cancelled"]])
        expect(tx.em.query.mock.calls).toEqual([
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, "evidence:cancelled"]],
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, "notice:cancelled"]],
        ])
        expect(events.record).not.toHaveBeenCalled()
        expect(messages.get.mock.calls).toEqual([
            ["bookings.notice.cancelled", { service: "Cut", when: "09:30 2026-10-15" }, "vi"],
        ])
        expect(notifier.notify.mock.calls).toEqual([
            [
                {
                    workspaceId: WORKSPACE,
                    conversationId: "conversation-1",
                    text: 'vi:bookings.notice.cancelled:{"service":"Cut","when":"09:30 2026-10-15"}',
                },
            ],
        ])
    })

    it.each([
        { phone: "84912345678", email: "mai@example.com", contact: "84912345678", handedOff: true },
        { phone: null, email: "mai@example.com", contact: "mai@example.com", handedOff: false },
        { phone: null, email: null, contact: null, handedOff: true },
    ])("hands a finished booking to inbound events with contact=$contact", async (test) => {
        const { service, tx, reminders, inbound, messages, events } = await build(
            [
                [
                    SELECT_BOOKING_FOR_EFFECTS,
                    [
                        rowOf({
                            status: "done",
                            customer_phone: test.phone,
                            customer_email: test.email,
                            conversation_id: null,
                        }),
                    ],
                ],
                ALREADY_CLAIMED,
            ],
            settingsOf({ handoffOrder: true }),
        )
        inbound.handOffOrder.mockImplementation(() => {
            expect(tx.outcomes).toEqual(["pending"])
            return Promise.resolve(test.handedOff)
        })

        await expect(service.apply(eventOf())).resolves.toEqual(
            effectsOf({ reminders: "stopped", handedOff: test.handedOff }),
        )

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(inbound.handOffOrder.mock.calls).toEqual([
            [
                {
                    workspaceId: WORKSPACE,
                    origin: "live",
                    sender: "Mai",
                    contact: test.contact,
                    body: 'vi:bookings.handoff.body:{"service":"Cut"}',
                    amountVnd: 200000,
                    ref: BOOKING_ID,
                    leadId: "lead-1",
                },
                manager,
            ],
        ])
        expect(messages.get.mock.calls).toEqual([["bookings.handoff.body", { service: "Cut" }, "vi"]])
        expect(tx.em.query.mock.calls).toEqual([
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, "evidence:done"]],
        ])
        expect(events.record).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["commit"])
    })

    it.each([
        { handoffOrder: false, price: 200000 },
        { handoffOrder: true, price: null },
        { handoffOrder: true, price: 0 },
        { handoffOrder: true, price: -1 },
    ])("skips hand-off with handoffOrder=$handoffOrder and price=$price", async ({ handoffOrder, price }) => {
        const { service, tx, inbound, messages } = await build(
            [[SELECT_BOOKING_FOR_EFFECTS, [rowOf({ status: "done", price_vnd: price })]], ALREADY_CLAIMED],
            settingsOf({ handoffOrder }),
        )

        await expect(service.apply(eventOf())).resolves.toEqual(effectsOf({ reminders: "stopped" }))

        expect(inbound.handOffOrder).not.toHaveBeenCalled()
        expect(messages.get).not.toHaveBeenCalled()
        expect(tx.em.query.mock.calls).toEqual([
            [SELECT_BOOKING_FOR_EFFECTS, [WORKSPACE, BOOKING_ID]],
            [CLAIM_EFFECT, [WORKSPACE, BOOKING_ID, "evidence:done"]],
        ])
    })
})

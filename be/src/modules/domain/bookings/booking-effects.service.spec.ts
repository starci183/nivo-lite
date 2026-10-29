import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import {
    ALREADY_CLAIMED,
    CLAIM,
    CLAIMED,
    FEE_CASES,
    HANDOFF_CASES,
    MISSING,
    NEXT_CLAIM,
    NO_EFFECTS,
    PUBLIC_CONTACT_CASES,
    RELEASED,
    RESOURCE_NAMES,
    SELECTED,
    SERVICE_NAMES,
    SKIPPED_HANDOFF_CASES,
    claimOf,
    effectsOf,
    eventOf,
    expectUntouched,
    feeWritten,
    found,
    namesCleared,
    releaseOf,
    traceOf,
} from "@tests/fixtures/builders/booking-effects-trace.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, builder, fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { INBOX } from "@modules/platform/inbox"
import { BookingEffectsService } from "./booking-effects.service"
import { BookingModelService } from "./booking-model.service"
import type { BookingNotifier } from "./booking-notice.contracts"
import { BookingNoticesService } from "./booking-notices.service"
import { DEFAULT_SETTINGS } from "./bookings.contracts"
import type { BookingSettings } from "./bookings.contracts"
import { BOOKINGS_NOTIFIER } from "./bookings.decorators"
import { noticeOf, FACTS, rowOf, evidenceOf } from "@tests/fixtures/builders/booking-effects.builder"

const WORKSPACE = "ws-1"
const BOOKING_ID = "b1"
const NOW = Date.UTC(2026, 9, 14, 5)
const START = Date.UTC(2026, 9, 15, 2, 30)
const HOUR = 3_600_000

const settingsOf = builder<BookingSettings>(DEFAULT_SETTINGS)

const build = async (steps: ReadonlyArray<QueryBuilderAnswers> = [], settings = settingsOf()) => {
    const inbox = fakeInbox()
    const tx = fakeTransaction(mockEntityManager())
    const fakes = queueQueryBuilders(tx.em, steps)
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
    notifier.notify.mockResolvedValue({ delivered: true, kept: true, via: "email" })
    const notices = mock<BookingNoticesService>()
    notices.factsOf.mockResolvedValue(FACTS)
    notices.textOf.mockReturnValue("Notice text")
    notices.subjectOf.mockReturnValue("Notice subject")
    const servicesRead = mock<BookingServicesReadService>({ namesOf: jest.fn(() => Promise.resolve(SERVICE_NAMES)) })
    const resourcesRead = mock<BookingResourcesReadService>({
        namesOf: jest.fn(() => Promise.resolve(RESOURCE_NAMES)),
    })
    const messages = mock<MessageCatalog>()
    messages.get.mockImplementation((key, params, locale) => `${locale}:${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingEffectsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: INBOX, useValue: inbox },
            { provide: BOOKINGS_NOTIFIER, useValue: notifier },
            { provide: BookingModelService, useValue: models },
            { provide: BookingNoticesService, useValue: notices },
            { provide: BookingRemindersService, useValue: reminders },
            { provide: EventsService, useValue: events },
            { provide: InboundEventsService, useValue: inbound },
            { provide: BookingServicesReadService, useValue: servicesRead },
            { provide: BookingResourcesReadService, useValue: resourcesRead },
        ],
    }).compile()
    const service = moduleRef.get(BookingEffectsService)
    return {
        service,
        tx,
        inbox,
        models,
        notices,
        reminders,
        events,
        inbound,
        notifier,
        messages,
        trace: () => traceOf(fakes),
        sets: () => fakes.map((fake) => evaluatedValues(fake.callsOf("set")[0]?.[0])),
    }
}

describe("BookingEffectsService", () => {
    beforeEach(namesCleared)

    it.each([
        { workspaceId: "", bookingId: BOOKING_ID },
        { workspaceId: WORKSPACE, bookingId: "" },
        { workspaceId: "", bookingId: "" },
    ])("returns no effects before doing any work for empty ids: %j", async (ids) => {
        const { service, tx, models, reminders, events, inbound, notifier, messages, trace } = await build()

        await expect(service.apply(eventOf(ids), CLAIM)).resolves.toEqual(NO_EFFECTS)

        expectUntouched(models.settings, tx.em.transaction)
        expect(trace()).toEqual([])
        expectUntouched(
            tx.em.createQueryBuilder,
            reminders.schedule,
            reminders.cancel,
            events.record,
            inbound.handOffOrder,
            notifier.notify,
            messages.get,
        )
    })

    it("returns no effects when the service of the booking is gone", async () => {
        const answers = found()
        SERVICE_NAMES.clear()
        const { service, reminders, trace } = await build([answers])

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(NO_EFFECTS)

        expect(trace()).toEqual([SELECTED])
        expect(reminders.schedule).not.toHaveBeenCalled()
    })

    it("returns no effects when the booking no longer exists", async () => {
        const { service, tx, models, reminders, notifier, events, inbound, trace } = await build([MISSING])

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(NO_EFFECTS)

        expect(models.settings.mock.calls).toEqual([[WORKSPACE]])
        expect(trace()).toEqual([SELECTED])
        expect(tx.outcomes).toEqual(["commit"])
        expectUntouched(reminders.schedule, reminders.cancel, notifier.notify, events.record, inbound.handOffOrder)
    })

    it("leaves a requested booking without reminders, fees, evidence or a notice", async () => {
        const { service, trace, reminders, notifier, events, messages, inbound } = await build([
            found(rowOf({ status: "requested", cancel_fee_vnd: 1000 })),
        ])

        await expect(service.apply(eventOf({ kind: "created" }), CLAIM)).resolves.toEqual(effectsOf())

        expect(trace()).toEqual([SELECTED])
        expectUntouched(
            reminders.schedule,
            reminders.cancel,
            events.record,
            notifier.notify,
            messages.get,
            inbound.handOffOrder,
        )
    })
})

describe("BookingEffectsService", () => {
    it.each([
        ["confirmed", "status", 0, "Asia/Ho_Chi_Minh", [24, 2], "confirmed", "notice:confirmed", true],
        ["rescheduled", "moved", 3, "UTC", [12, 1], "moved", "notice:moved:3", false],
    ] as const)("plans %s reminders and processes its notice after commit", async (...values) => {
        const [status, kind, count, timezone, hours, notice, mark, delivered] = values
        const test = { status, kind, count, timezone, hours, notice, mark, delivered }
        const row = rowOf({ status: test.status, reschedule_count: test.count })
        const settings = settingsOf({ timezone: test.timezone, reminderHours: test.hours })
        const steps = [found(row), CLAIMED, RELEASED]
        const { service, tx, trace, reminders, notices, notifier, messages, events, inbound } = await build(
            steps,
            settings,
        )
        notifier.notify.mockImplementation(() => {
            expect(tx.outcomes).toEqual(["commit"])
            expect(trace()).toEqual([SELECTED, claimOf(test.mark)])
            return Promise.resolve({ delivered: test.delivered, kept: test.delivered, via: "email" })
        })

        await expect(service.apply(eventOf({ kind: test.kind }), CLAIM)).resolves.toEqual(
            effectsOf({ reminders: "planned", notified: test.delivered }),
        )

        const manager = reminders.schedule.mock.calls[0]?.[0].manager
        expect(isTransactionManager(manager)).toBe(true)
        const plan = {
            manager,
            workspaceId: WORKSPACE,
            bookingId: BOOKING_ID,
            startMs: START,
            nowMs: NOW,
            defaultHours: test.hours,
        }
        expect(reminders.schedule.mock.calls).toEqual([[plan]])
        expect(trace()).toEqual([SELECTED, claimOf(test.mark), ...(!test.delivered ? [releaseOf(test.mark)] : [])])
        expect(notices.factsOf.mock.calls).toEqual([[WORKSPACE, row, settings, 0]])
        expect(notices.textOf.mock.calls).toEqual([[test.notice, FACTS]])
        expect(notices.subjectOf.mock.calls).toEqual([[test.notice, "Cut"]])
        expect(messages.get).not.toHaveBeenCalled()
        expect(notifier.notify.mock.calls).toEqual([
            [noticeOf({ kind: test.notice, dedupeKey: `${BOOKING_ID}:${test.mark}` })],
        ])
        expectUntouched(reminders.cancel, events.record, inbound.handOffOrder)
    })

    it("claims the delivery under the row lock and changes nothing twice for a redelivery, but still owes the notice", async () => {
        const { service, tx, inbox, reminders, events, inbound, notifier } = await build([found(), CLAIMED])
        inbox.seen(CLAIM.consumer, CLAIM.dedupeKey)

        await expect(service.apply(eventOf(), CLAIM)).resolves.toMatchObject({
            found: true,
            reminders: "none",
            notified: true,
        })

        expect(inbox.claims).toEqual([{ source: CLAIM.consumer, eventId: CLAIM.dedupeKey }])
        expectUntouched(reminders.schedule, events.record, inbound.handOffOrder)
        expect(notifier.notify).toHaveBeenCalledTimes(1)
        expect(tx.outcomes).toEqual(["commit"])
    })
})

describe("BookingEffectsService", () => {
    it("releases a failed notice claim before retrying a rejected delivery", async () => {
        const { service, tx, notifier, trace, sets } = await build([found(), CLAIMED, RELEASED, found(), CLAIMED])
        const failure = new Error("Channel delivery is unavailable")
        notifier.notify.mockRejectedValueOnce(failure)

        await expect(service.apply(eventOf(), CLAIM)).rejects.toBe(failure)
        expect(trace()).toEqual([SELECTED, claimOf("notice:confirmed"), releaseOf("notice:confirmed")])
        expect(sets().slice(1, 3)).toEqual([
            { effects: "effects || jsonb_build_object(CAST(:mark AS text), true)" },
            { effects: "effects - CAST(:mark AS text)" },
        ])
        expect(tx.outcomes).toEqual(["commit"])

        await expect(service.apply(eventOf(), NEXT_CLAIM)).resolves.toEqual(
            effectsOf({ reminders: "planned", notified: true }),
        )
        expect(notifier.notify).toHaveBeenCalledTimes(2)
        expect(trace()).toEqual([
            SELECTED,
            claimOf("notice:confirmed"),
            releaseOf("notice:confirmed"),
            SELECTED,
            claimOf("notice:confirmed"),
        ])
        expect(tx.outcomes).toEqual(["commit", "commit"])
    })

    it("keeps a queued notice mark even when the customer has not received the notice", async () => {
        const { service, tx, notifier, trace } = await build([found(), CLAIMED, found(), ALREADY_CLAIMED])
        notifier.notify.mockResolvedValue({ delivered: false, kept: true, via: "email" })

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(effectsOf({ reminders: "planned" }))
        await expect(service.apply(eventOf(), NEXT_CLAIM)).resolves.toEqual(effectsOf({ reminders: "planned" }))

        expect(notifier.notify.mock.calls).toEqual([[noticeOf()]])
        const claim = claimOf("notice:confirmed")
        expect(trace()).toEqual([SELECTED, claim, SELECTED, claim])
        expect(tx.outcomes).toEqual(["commit", "commit"])
    })

    it.each(PUBLIC_CONTACT_CASES)("notifies a public-page booking with lead=$lead_id and email=$customer_email", async (contact) => {
        const row = rowOf({ ...contact, conversation_id: null })
        const { service, trace, notices, notifier } = await build([found(row), CLAIMED])

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(
            effectsOf({ reminders: "planned", notified: true }),
        )

        expect(notices.factsOf.mock.calls).toEqual([[WORKSPACE, row, settingsOf(), 0]])
        expect(notices.textOf.mock.calls).toEqual([["confirmed", FACTS]])
        expect(notices.subjectOf.mock.calls).toEqual([["confirmed", "Cut"]])
        expect(notifier.notify.mock.calls).toEqual([
            [
                noticeOf({
                    leadId: contact.lead_id,
                    conversationId: null,
                    email: contact.customer_email,
                }),
            ],
        ])
        expect(trace()).toEqual([SELECTED, claimOf("notice:confirmed")])
    })

    it.each([true, false])("skips an already claimed notice when conversation exists=%s", async (conversation) => {
        const { service, trace, reminders, notifier, messages, notices } = await build([
            found(rowOf({ conversation_id: conversation ? "conversation-1" : null })),
            ALREADY_CLAIMED,
        ])

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(effectsOf({ reminders: "planned" }))

        expect(reminders.schedule).toHaveBeenCalledTimes(1)
        expect(trace()).toEqual([SELECTED, claimOf("notice:confirmed")])
        expectUntouched(notifier.notify, messages.get, notices.factsOf, notices.textOf, notices.subjectOf)
    })
})

describe("BookingEffectsService", () => {
    it.each(FEE_CASES)("stops $status reminders and retains or records fee $recorded (policy=$fee)", async (test) => {
        const row = rowOf({
            status: test.status,
            conversation_id: null,
            cancelled_ms: START - HOUR,
            cancel_fee_vnd: test.previous,
        })
        const settings = settingsOf({
            cancelWindowHours: 2,
            lateCancelFeePct: test.fee === 0 ? 0 : 37,
            noShowFeeVnd: test.fee === 0 ? 0 : 35000,
        })
        const steps = [
            found(row),
            ...(test.fee > 0 ? [feeWritten(test.changed)] : []),
            CLAIMED,
            ...(test.status === "done" ? [] : [CLAIMED]),
        ]
        const { service, tx, trace, reminders, events, messages, notifier, notices, inbound } = await build(
            steps,
            settings,
        )
        notifier.notify.mockImplementation(() => {
            expect(tx.outcomes).toEqual(["commit"])
            return Promise.resolve({ delivered: true, kept: true, via: "email" })
        })

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(
            effectsOf({ reminders: "stopped", feeVnd: test.recorded, notified: test.status !== "done" }),
        )

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(reminders.cancel.mock.calls).toEqual([[manager, BOOKING_ID, `booking_${test.status}`]])
        expect(reminders.schedule).not.toHaveBeenCalled()
        expect(trace()).toEqual([
            SELECTED,
            ...(test.fee > 0 ? [`fee:${test.fee}`] : []),
            claimOf(`evidence:${test.status}`),
            ...(test.status !== "done" ? [claimOf(`notice:${test.status}`)] : []),
        ])
        const evidence = evidenceOf({
            kind: `booking.${test.status}`,
            summary: `vi:bookings.evidence.${test.status}:{"service":"Cut","customer":"Mai"}`,
        })
        expect(events.record.mock.calls).toEqual([[evidence, manager]])
        expect(messages.get.mock.calls).toEqual([
            ["bookings.evidence.actor", {}, "vi"],
            [`bookings.evidence.${test.status}`, { service: "Cut", customer: "Mai" }, "vi"],
        ])
        if (test.status === "done") {
            expectUntouched(notifier.notify, notices.factsOf)
        } else {
            expect(notices.factsOf.mock.calls).toEqual([[WORKSPACE, row, settings, test.recorded]])
            expect(notices.textOf.mock.calls).toEqual([[test.status, FACTS]])
            expect(notices.subjectOf.mock.calls).toEqual([[test.status, "Cut"]])
            expect(notifier.notify.mock.calls).toEqual([
                [
                    noticeOf({
                        kind: test.status === "no_show" ? "no_show" : "cancelled",
                        conversationId: null,
                        dedupeKey: `${BOOKING_ID}:notice:${test.status}`,
                    }),
                ],
            ])
        }
        expect(inbound.handOffOrder).not.toHaveBeenCalled()
    })
})

describe("BookingEffectsService", () => {
    it("records evidence once when the closed booking event is repeated", async () => {
        const { service, tx, trace, reminders, events, messages } = await build([
            found(rowOf({ status: "done", conversation_id: null, lead_id: null })),
            CLAIMED,
            found(rowOf({ status: "done", conversation_id: null, lead_id: null })),
            ALREADY_CLAIMED,
        ])

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(effectsOf({ reminders: "stopped" }))
        await expect(service.apply(eventOf(), NEXT_CLAIM)).resolves.toEqual(effectsOf({ reminders: "stopped" }))

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(events.record.mock.calls).toEqual([[evidenceOf({ leadId: null }), manager]])
        expect(messages.get.mock.calls).toEqual([
            ["bookings.evidence.actor", {}, "vi"],
            ["bookings.evidence.done", { service: "Cut", customer: "Mai" }, "vi"],
        ])
        expect(trace()).toEqual([SELECTED, claimOf("evidence:done"), SELECTED, claimOf("evidence:done")])
        expect(tx.outcomes).toEqual(["commit", "commit"])
    })

    it("tells the customer about a cancellation whose evidence was already recorded", async () => {
        const row = rowOf({ status: "cancelled" })
        const { service, trace, reminders, notifier, notices, messages, events } = await build([
            found(row),
            ALREADY_CLAIMED,
            CLAIMED,
        ])

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(
            effectsOf({ reminders: "stopped", notified: true }),
        )

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(reminders.cancel.mock.calls).toEqual([[manager, BOOKING_ID, "booking_cancelled"]])
        expect(trace()).toEqual([SELECTED, claimOf("evidence:cancelled"), claimOf("notice:cancelled")])
        expectUntouched(events.record, messages.get)
        expect(notices.factsOf.mock.calls).toEqual([[WORKSPACE, row, settingsOf(), 0]])
        expect(notices.textOf.mock.calls).toEqual([["cancelled", FACTS]])
        expect(notices.subjectOf.mock.calls).toEqual([["cancelled", "Cut"]])
        expect(notifier.notify.mock.calls).toEqual([
            [noticeOf({ kind: "cancelled", dedupeKey: `${BOOKING_ID}:notice:cancelled` })],
        ])
    })
})

describe("BookingEffectsService", () => {
    it.each(HANDOFF_CASES)("hands a finished booking to inbound events with contact=$contact", async (test) => {
        const row = rowOf({
            status: "done",
            customer_phone: test.phone,
            customer_email: test.email,
            conversation_id: null,
        })
        const { service, tx, trace, reminders, inbound, messages, events } = await build(
            [found(row), ALREADY_CLAIMED],
            settingsOf({ handoffOrder: true }),
        )
        inbound.handOffOrder.mockImplementation(() => {
            expect(tx.outcomes).toEqual(["pending"])
            return Promise.resolve(test.handedOff)
        })

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(
            effectsOf({ reminders: "stopped", handedOff: test.handedOff }),
        )

        const manager = reminders.cancel.mock.calls[0]?.[0]
        expect(isTransactionManager(manager)).toBe(true)
        expect(inbound.handOffOrder.mock.calls).toEqual([
            [
                {
                    workspaceId: WORKSPACE,
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
        expect(trace()).toEqual([SELECTED, claimOf("evidence:done")])
        expect(events.record).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["commit"])
    })

    it.each(SKIPPED_HANDOFF_CASES)("skips hand-off with handoffOrder=$handoffOrder and price=$price", async ({ handoffOrder, price }) => {
        const { service, trace, inbound, messages } = await build(
            [found(rowOf({ status: "done", price_vnd: price })), ALREADY_CLAIMED],
            settingsOf({ handoffOrder }),
        )

        await expect(service.apply(eventOf(), CLAIM)).resolves.toEqual(effectsOf({ reminders: "stopped" }))

        expectUntouched(inbound.handOffOrder, messages.get)
        expect(trace()).toEqual([SELECTED, claimOf("evidence:done")])
    })
})

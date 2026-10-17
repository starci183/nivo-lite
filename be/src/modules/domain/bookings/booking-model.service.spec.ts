import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingModelService } from "./booking-model.service"
import {
    SELECT_EXCEPTIONS,
    SELECT_HELD_SPANS,
    SELECT_HOURS,
    SELECT_LEAVE_DAYS,
    SELECT_RESOURCES,
    SELECT_SERVICES,
    SELECT_SETTINGS,
} from "./persistence/booking-model.sql"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"

const SETTINGS_ROW = {
    timezone: "Asia/Ho_Chi_Minh",
    slot_step_min: 30,
    min_lead_min: 10,
    max_advance_days: 20,
    cancel_window_hours: 12,
    deposit_pct: 30,
    late_cancel_fee_pct: 50,
    no_show_fee_vnd: 100000,
    auto_confirm: false,
    handoff_order: true,
    reminder_hours: [48],
    public_enabled: true,
    public_slug: "spa-anna",
    public_note: "Welcome",
    address: "1 Main St",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingModelService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingModelService)
}

describe("BookingModelService", () => {
    describe("settings", () => {
        it("maps the saved settings", async () => {
            const model = await build(mockEntityManager({ query: [SELECT_SETTINGS, [SETTINGS_ROW]] }))

            await expect(model.settings("ws-1")).resolves.toEqual({
                timezone: "Asia/Ho_Chi_Minh",
                slotStepMin: 30,
                minLeadMin: 10,
                maxAdvanceDays: 20,
                cancelWindowHours: 12,
                depositPct: 30,
                lateCancelFeePct: 50,
                noShowFeeVnd: 100000,
                autoConfirm: false,
                handoffOrder: true,
                reminderHours: [48],
                publicEnabled: true,
                publicSlug: "spa-anna",
                publicNote: "Welcome",
                address: "1 Main St",
            })
        })

        it("falls back to the defaults of a workspace that never saved any", async () => {
            const model = await build(mockEntityManager({ query: [SELECT_SETTINGS, []] }))

            await expect(model.settings("ws-1")).resolves.toBe(DEFAULT_SETTINGS)
        })
    })
})

describe("BookingModelService", () => {
    describe("model", () => {
        it("reads settings, services, resources, hours and exceptions together", async () => {
            const model = await build(
                mockEntityManager({
                    query: [
                        [SELECT_SETTINGS, [SETTINGS_ROW]],
                        [
                            SELECT_SERVICES,
                            [
                                {
                                    id: "s1",
                                    name: "Cut",
                                    description: "",
                                    duration_min: 45,
                                    buffer_min: 15,
                                    price_vnd: 200000,
                                    resource_kind: null,
                                    followup_days: null,
                                    active: true,
                                },
                            ],
                        ],
                        [
                            SELECT_RESOURCES,
                            [{ id: "r1", name: "Anna", kind: "staff", capacity: 1, active: true, sort_order: 2 }],
                        ],
                        [
                            SELECT_HOURS,
                            [{ resource_id: "r1", weekday: 1, start_time: "09:00:00", end_time: "17:00:00" }],
                        ],
                        [
                            SELECT_EXCEPTIONS,
                            [
                                {
                                    resource_id: null,
                                    on_date: "2026-10-12",
                                    closed: true,
                                    start_time: null,
                                    end_time: null,
                                },
                                {
                                    resource_id: "r1",
                                    on_date: "2026-10-13",
                                    closed: false,
                                    start_time: "10:00:00",
                                    end_time: "12:00:00",
                                },
                            ],
                        ],
                    ],
                }),
            )

            const result = await model.model("ws-1")

            expect(result.services).toEqual([
                {
                    id: "s1",
                    name: "Cut",
                    description: "",
                    durationMin: 45,
                    bufferMin: 15,
                    priceVnd: 200000,
                    resourceKind: null,
                    active: true,
                },
            ])
            expect(result.resources).toEqual([
                { id: "r1", name: "Anna", kind: "staff", capacity: 1, active: true, sort: 2 },
            ])
            expect(result.hours).toEqual([{ resourceId: "r1", weekday: 1, start: "09:00", end: "17:00" }])
            expect(result.exceptions).toEqual([
                { resourceId: null, date: "2026-10-12", closed: true, start: null, end: null },
                { resourceId: "r1", date: "2026-10-13", closed: false, start: "10:00", end: "12:00" },
            ])
            expect(result.settings.slotStepMin).toBe(30)
        })
    })
})

describe("BookingModelService", () => {
    describe("spans", () => {
        it("joins the held bookings with the whole-day blocks of approved leave", async () => {
            const entityManager = mockEntityManager({
                query: [
                    [
                        SELECT_HELD_SPANS,
                        [{ id: "b1", resource_id: "r1", party_size: 2, start_ms: 1000, block_end_ms: 2000 }],
                    ],
                    [
                        SELECT_LEAVE_DAYS,
                        [{ resource_id: "r2", leave_staff: "p1", from_date: "2026-10-12", to_date: "2026-10-12" }],
                    ],
                ],
            })
            const model = await build(entityManager)
            const from = Date.UTC(2026, 9, 11, 17)

            const spans = await model.spans("ws-1", from, from + 86_400_000, "Asia/Ho_Chi_Minh")

            expect(spans).toEqual([
                { id: "b1", resourceId: "r1", startMs: 1000, blockEndMs: 2000, partySize: 2 },
                {
                    id: "leave:p1:2026-10-12",
                    resourceId: "r2",
                    startMs: Date.UTC(2026, 9, 11, 17),
                    blockEndMs: Date.UTC(2026, 9, 12, 17),
                    partySize: 1000,
                },
            ])
            expect(entityManager.query).toHaveBeenCalledWith(SELECT_HELD_SPANS, [
                "ws-1",
                "2026-10-11T17:00:00.000Z",
                "2026-10-12T17:00:00.000Z",
            ])
            expect(entityManager.query).toHaveBeenCalledWith(SELECT_LEAVE_DAYS, ["ws-1", "2026-10-12", "2026-10-13"])
        })
    })
})

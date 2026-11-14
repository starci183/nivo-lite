import { Test } from "@nestjs/testing"
import { CALENDAR_EVENT_CREATE_SCHEMA, CALENDAR_SLOT_FREE_LIST_SCHEMA } from "./calendar-native.schema"

const SUBJECT = Symbol("calendar-native.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { CALENDAR_EVENT_CREATE_SCHEMA, CALENDAR_SLOT_FREE_LIST_SCHEMA } }],
    }).compile()
    return moduleRef.get<{
        CALENDAR_EVENT_CREATE_SCHEMA: typeof CALENDAR_EVENT_CREATE_SCHEMA
        CALENDAR_SLOT_FREE_LIST_SCHEMA: typeof CALENDAR_SLOT_FREE_LIST_SCHEMA
    }>(SUBJECT)
}

const EVENT = { summary: "Fitting", start: "2026-11-14T09:00:00+07:00", end: "2026-11-14T10:00:00+07:00" }

describe("the calendar tool schemas", () => {
    it("take a guest address of 320 characters and refuse a longer one", async () => {
        const { CALENDAR_EVENT_CREATE_SCHEMA: schema } = await build()
        expect(schema.safeParse({ ...EVENT, guests: [`${"a".repeat(310)}@b.co`] }).success).toBe(true)
        expect(schema.safeParse({ ...EVENT, guests: [`${"a".repeat(400)}@b.co`] }).success).toBe(false)
    })

    it("take a moment with a long fraction up to 64 characters and refuse a longer one", async () => {
        const { CALENDAR_EVENT_CREATE_SCHEMA: schema } = await build()
        const moment = (digits: number): string => `2026-11-14T09:00:00.${"1".repeat(digits)}+07:00`
        expect(schema.safeParse({ ...EVENT, start: moment(30) }).success).toBe(true)
        expect(schema.safeParse({ ...EVENT, start: moment(60) }).success).toBe(false)
    })

    it("take the daily hours as a clock of five characters and refuse a longer clock", async () => {
        const { CALENDAR_SLOT_FREE_LIST_SCHEMA: schema } = await build()
        const search = {
            windowStart: "2026-11-14T00:00:00+07:00",
            windowEnd: "2026-11-15T00:00:00+07:00",
            durationMinutes: 30,
            timeZone: "Asia/Ho_Chi_Minh",
        }
        expect(schema.safeParse({ ...search, dailyHours: { from: "08:00", to: "17:30" } }).success).toBe(true)
        expect(schema.safeParse({ ...search, dailyHours: { from: "08:00:00", to: "17:30" } }).success).toBe(false)
    })
})

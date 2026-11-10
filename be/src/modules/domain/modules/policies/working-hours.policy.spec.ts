import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import * as policy from "./working-hours.policy"

const SUBJECT = Symbol("working-hours.policy")

/** The policy, bound as a kit double over its real functions. */
const subject = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: subject }] }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

/** Monday to Friday 08:00-20:00, Saturday 08:00-12:00, Sunday off; not answering after hours. */
const STORED = JSON.stringify({
    v: 1,
    afterHours: false,
    days: [
        [["08:00", "20:00"]],
        [["08:00", "20:00"]],
        [["08:00", "20:00"]],
        [["08:00", "20:00"]],
        [["08:00", "20:00"]],
        [["08:00", "12:00"]],
        [],
    ],
})

/** A moment given as Vietnam's clock (UTC+7). */
const vn = (iso: string): Date => new Date(`${iso}+07:00`)

describe("working-hours.policy: the stored shape", () => {
    it("reads the web's JSON text, merging and ordering the ranges of a day, and writes it back the same way", async () => {
        const { workingHoursOf, workingHoursTextOf } = await buildPolicy()
        const hours = workingHoursOf(STORED)
        expect(hours?.afterHours).toBe(false)
        expect(hours?.days[0]).toEqual([{ start: 480, end: 1200 }])
        expect(workingHoursTextOf(hours ?? { afterHours: true, days: [] })).toBe(STORED)

        const messy = {
            v: 1,
            days: [
                [
                    ["13:00", "17:00"],
                    ["08:00", "13:30"],
                ],
                [],
                [],
                [],
                [],
                [],
                [["20:00", "24:00"]],
            ],
        }
        const read = workingHoursOf(messy)
        expect(read?.afterHours).toBe(true)
        expect(read?.days[0]).toEqual([{ start: 480, end: 1020 }])
        expect(read?.days[6]).toEqual([{ start: 1200, end: 1440 }])
    })

    it("refuses anything that is not the saved shape", async () => {
        const { workingHoursOf } = await buildPolicy()
        expect(workingHoursOf("not json")).toBeNull()
        expect(workingHoursOf({ v: 2, days: [] })).toBeNull()
        expect(workingHoursOf({ v: 1, days: [[], [], []] })).toBeNull()
        expect(workingHoursOf({ v: 1, days: [[["20:00", "08:00"]], [], [], [], [], [], []] })).toBeNull()
        expect(workingHoursOf({ v: 1, days: [[["8h", "20:00"]], [], [], [], [], [], []] })).toBeNull()
        expect(workingHoursOf({ v: 1, days: [[["08:00"]], [], [], [], [], [], []] })).toBeNull()
        expect(workingHoursOf(null)).toBeNull()
    })
})

describe("working-hours.policy: on duty", () => {
    it("tells on and off duty in the workspace's time zone", async () => {
        const { onDutyAt, workingHoursOf } = await buildPolicy()
        const hours = workingHoursOf(STORED)
        expect(hours).not.toBeNull()
        if (hours === null) return
        expect(onDutyAt(hours, vn("2026-11-09T09:00:00"))).toBe(true)
        expect(onDutyAt(hours, vn("2026-11-09T20:00:00"))).toBe(false)
        expect(onDutyAt(hours, vn("2026-11-14T11:59:00"))).toBe(true)
        expect(onDutyAt(hours, vn("2026-11-15T10:00:00"))).toBe(false)
    })

    it("finds the next working hour: later the same day, the next day, or past a day off", async () => {
        const { nextOnDutyAt, workingHoursOf } = await buildPolicy()
        const hours = workingHoursOf(STORED)
        expect(hours).not.toBeNull()
        if (hours === null) return
        expect(nextOnDutyAt(hours, vn("2026-11-09T06:30:00"))).toEqual(vn("2026-11-09T08:00:00"))
        expect(nextOnDutyAt(hours, vn("2026-11-09T21:15:00"))).toEqual(vn("2026-11-10T08:00:00"))
        expect(nextOnDutyAt(hours, vn("2026-11-14T13:00:00"))).toEqual(vn("2026-11-16T08:00:00"))
        expect(
            nextOnDutyAt({ afterHours: false, days: [[], [], [], [], [], [], []] }, vn("2026-11-09T06:30:00")),
        ).toBeNull()
    })

    it("holds a customer only off duty, with hours kept and answering after hours off", async () => {
        const { holdsCustomerAt, workingHoursOf } = await buildPolicy()
        const hours = workingHoursOf(STORED)
        expect(holdsCustomerAt(hours, vn("2026-11-09T21:00:00"))).toBe(true)
        expect(holdsCustomerAt(hours, vn("2026-11-09T10:00:00"))).toBe(false)
        expect(holdsCustomerAt(hours === null ? null : { ...hours, afterHours: true }, vn("2026-11-09T21:00:00"))).toBe(
            false,
        )
        expect(holdsCustomerAt(null, vn("2026-11-09T21:00:00"))).toBe(false)
        expect(
            holdsCustomerAt({ afterHours: false, days: [[], [], [], [], [], [], []] }, vn("2026-11-09T21:00:00")),
        ).toBe(false)
    })
})

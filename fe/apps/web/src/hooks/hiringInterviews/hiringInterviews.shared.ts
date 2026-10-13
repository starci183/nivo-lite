import type { InterviewView } from "@/hooks/hiringWire"
import { PRODUCT_TIME_ZONE, shiftDate, wallDate, wallInstant, weekStartOf } from "@/modules/i18n"

/** One day of the week calendar on the Vietnam clock, with the confirmed interviews that start in it. */
interface CalendarDay {
    readonly date: string
    /** The first instant of the day, ISO. */
    readonly startIso: string
    readonly isToday: boolean
    readonly items: ReadonlyArray<InterviewView>
}

const DAYS_IN_WEEK = 7

/** The seven days (Monday first) of the week `offset` weeks from the one `nowIso` falls in. */
export const weekDays = (
    nowIso: string,
    offset: number,
    interviews: ReadonlyArray<InterviewView>,
): Array<CalendarDay> => {
    const today = wallDate(Date.parse(nowIso), PRODUCT_TIME_ZONE)
    const monday = shiftDate(weekStartOf(today), offset * DAYS_IN_WEEK)
    const confirmed = interviews.filter((interview) => interview.status === "confirmed" && interview.slotStart !== null)
    return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
        const date = shiftDate(monday, index)
        const start = wallInstant(date, "00:00", PRODUCT_TIME_ZONE)
        const end = wallInstant(shiftDate(date, 1), "00:00", PRODUCT_TIME_ZONE)
        return {
            date,
            startIso: new Date(start).toISOString(),
            isToday: date === today,
            items: confirmed
                .filter((interview) => {
                    const at = Date.parse(interview.slotStart ?? "")
                    return at >= start && at < end
                })
                .sort((a, b) => (a.slotStart ?? "").localeCompare(b.slotStart ?? "")),
        }
    })
}

/** The invitations still waiting for the candidate to pick a time. */
export const proposedOf = (interviews: ReadonlyArray<InterviewView>): Array<InterviewView> =>
    interviews.filter((interview) => interview.status === "proposed")

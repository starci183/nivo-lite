/** One message of the open conversation, with every word resolved. */
export interface ChatThreadMessage {
    id: string
    role: "user" | "system" | "agent"
    body: string
    /** The time of day the message was written. */
    timeLabel: string
    /** The day it opens when it is the first of its day ("Today"), else null: the thread draws a divider before it. */
    dayLabel: string | null
    files: {
        id: string
        name: string
        contentType: string
        url: string
    }[]
}

/** The calendar days between a moment and now: 0 is today, 1 is yesterday. */
export const daysAgoOf = (iso: string, now: Date): number => {
    const day = (value: Date): number => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
    return Math.round((day(now) - day(new Date(iso))) / 86_400_000)
}

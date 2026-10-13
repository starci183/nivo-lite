/** A weekly opening window for one booking resource. */
export interface BookingOpeningWindow {
    /** The ISO weekday, from Monday (1) through Sunday (7). */
    readonly weekday: number
    /** The opening clock time in HH:mm form. */
    readonly start: string
    /** The closing clock time in HH:mm form. */
    readonly end: string
}

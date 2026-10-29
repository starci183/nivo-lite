/** One weekly opening window as other capabilities read it. */
export interface BookingHourRecord {
    /** The resource. */
    readonly resourceId: string
    /** The ISO weekday, Monday 1 to Sunday 7. */
    readonly weekday: number
    /** The opening time. */
    readonly startTime: string
    /** The closing time. */
    readonly endTime: string
}

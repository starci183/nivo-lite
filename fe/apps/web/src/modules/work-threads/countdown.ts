const twoDigits = (value: number): string => String(value).padStart(2, "0")

/** The local wall-clock time of an instant, as hours and minutes ("09:42"). */
export const wallClockOf = (at: string): string => {
    const date = new Date(at)
    return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
}

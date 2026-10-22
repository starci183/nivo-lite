const SECOND_MS = 1000

const twoDigits = (value: number): string => String(value).padStart(2, "0")

/** How long an approval has left, as minutes and seconds ("28:14"); "0:00" once the instant has passed. */
export const countdownOf = (expiresAt: string, now: number): string => {
    const seconds = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / SECOND_MS))
    return `${Math.floor(seconds / 60)}:${twoDigits(seconds % 60)}`
}

/** Whether the instant has passed. */
export const hasPassed = (expiresAt: string, now: number): boolean => Date.parse(expiresAt) <= now

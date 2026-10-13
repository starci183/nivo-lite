const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u

/** True for a real calendar day written YYYY-MM-DD. */
export const isDay = (text: string): boolean => {
    if (!DAY_PATTERN.test(text)) return false
    const parsed = new Date(`${text}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text
}

/** True for a time of day written HH:MM. */
export const isTime = (text: string): boolean => TIME_PATTERN.test(text)

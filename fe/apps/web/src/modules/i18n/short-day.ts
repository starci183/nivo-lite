/** The Vietnamese short weekdays, by the English short name the formatter gives for the same day. */
const VI_WEEKDAYS: Readonly<Record<string, string>> = {
    Mon: "T2",
    Tue: "T3",
    Wed: "T4",
    Thu: "T5",
    Fri: "T6",
    Sat: "T7",
    Sun: "CN",
}

/** The short weekday and day-month of an instant on one clock, as the public pages write a day: "T5, 06/11" or "Thu, 06/11". */
export const shortDayText = (instant: Date, timeZone: string, locale: string): string => {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(instant)
    const dayMonth = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
        day: "2-digit",
        month: "2-digit",
        timeZone,
    }).format(instant)
    return `${locale === "vi" ? (VI_WEEKDAYS[weekday] ?? weekday) : weekday}, ${dayMonth}`
}

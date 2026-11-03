import timezone from "dayjs/plugin/timezone"
import { i18n } from "@/modules/i18n"
import { dayjs } from "./index"

dayjs.extend(timezone)

/** A machine calendar day in the product time zone, optionally shifted by whole days. */
export const productCalendarDay = (date: Date, offsetDays = 0): string =>
    dayjs(date).tz(i18n.timeZone).add(offsetDays, "day").format("YYYY-MM-DD")

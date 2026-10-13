import timezone from "dayjs/plugin/timezone"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"
import { dayjs } from "./index"

dayjs.extend(timezone)

/** A machine calendar day in the product time zone, optionally shifted by whole days. */
export const productCalendarDay = (date: Date, offsetDays = 0): string =>
    dayjs(date).tz(PRODUCT_TIME_ZONE).add(offsetDays, "day").format("YYYY-MM-DD")

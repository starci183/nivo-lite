import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import utc from "dayjs/plugin/utc"

dayjs.extend(utc)
dayjs.extend(relativeTime)

/** The one dayjs instance of the app (date math and parsing only; display goes through the next-intl formatter). */
export { dayjs }

export { productCalendarDay } from "./product-calendar"

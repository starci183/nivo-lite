import { catalogueCopyOf, type CatalogueCopy } from "../../catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the booking template's own message catalogue. */
export type BookingCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the booking template, read from its own message catalogue. */
export const BOOKING_COPY: CatalogueCopy<BookingCopyKey> = catalogueCopyOf<BookingCopyKey>(vi, en)

import { catalogueCopyOf, type CatalogueCopy } from "../../catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the video template's own message catalogue. */
export type VideoCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the video template, read from its own message catalogue. */
export const VIDEO_COPY: CatalogueCopy<VideoCopyKey> = catalogueCopyOf<VideoCopyKey>(vi, en)

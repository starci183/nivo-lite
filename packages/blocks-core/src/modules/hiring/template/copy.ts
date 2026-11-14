import { catalogueCopyOf, type CatalogueCopy } from "../../catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the hiring template's own message catalogue. */
export type HiringCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the hiring template, read from its own message catalogue. */
export const HIRING_COPY: CatalogueCopy<HiringCopyKey> = catalogueCopyOf<HiringCopyKey>(vi, en)

import { catalogueCopyOf, type CatalogueCopy } from "../../../shared/agent/catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the content template's own message catalogue. */
export type ContentCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the content template, read from its own message catalogue. */
export const CONTENT_COPY: CatalogueCopy<ContentCopyKey> = catalogueCopyOf<ContentCopyKey>(vi, en)

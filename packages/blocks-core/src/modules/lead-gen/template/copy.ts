import { catalogueCopyOf, type CatalogueCopy } from "../../catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the lead gen template's own message catalogue. */
export type LeadGenCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the lead gen template, read from its own message catalogue. */
export const LEAD_GEN_COPY: CatalogueCopy<LeadGenCopyKey> = catalogueCopyOf<LeadGenCopyKey>(vi, en)

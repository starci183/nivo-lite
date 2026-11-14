import { catalogueCopyOf, type CatalogueCopy } from "../../catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the sales template's own message catalogue. */
export type SalesCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the sales template, read from its own message catalogue. */
export const SALES_COPY: CatalogueCopy<SalesCopyKey> = catalogueCopyOf<SalesCopyKey>(vi, en)

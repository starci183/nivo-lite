import { catalogueCopyOf, type CatalogueCopy } from "../../../../shared/agent/catalogue-copy"
import * as en from "./messages/en.json"
import * as vi from "./messages/vi.json"

/** A key of the ledger area of the Sales template's own message catalogue. */
export type AccountingCopyKey = Exclude<keyof typeof vi, "default">

/** The words of the ledger area of the Sales template, read from its own message catalogue. */
export const ACCOUNTING_COPY: CatalogueCopy<AccountingCopyKey> = catalogueCopyOf<AccountingCopyKey>(vi, en)

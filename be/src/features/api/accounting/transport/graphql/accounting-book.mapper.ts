import type { AccountingBookView } from "@modules/domain/accounting"
import type { AccountingBookType } from "./dto/accounting-book.type"

/** Maps the normalized accounting view to its GraphQL type. */
export const toAccountingBookType = (book: AccountingBookView): AccountingBookType => ({ ...book })

import { GOOGLE_MESSAGES } from "./messages/google.messages"

const TEXT = GOOGLE_MESSAGES.vi

/** One text of the sheet product copy, with `{{name}}` placeholders filled. */
const translate = (key: string, params: Readonly<Record<string, string | number>> = {}): string =>
    (TEXT[key] ?? key).replaceAll(/\{\{(\w+)\}\}/gu, (_, name: string) => String(params[name] ?? ""))

/** The title of the ledger tab (the cash book). */
export const ledgerTab = (): string => translate("sheet.ledgerTab")

const LEDGER_COLUMNS = ["date", "document", "description", "in", "out", "counterpart", "category", "balance"] as const

/** The ledger header row: date, document, description, in, out, counterpart, category, balance. */
export const ledgerHeader = (): ReadonlyArray<string> =>
    LEDGER_COLUMNS.map((column) => translate(`sheet.ledgerHeader.${column}`))

/** The words of a ledger category code (a sale, other income...); the code itself when it has none. */
export const ledgerCategoryText = (category: string): string => translate(`sheet.ledgerCategory.${category}`)

/** The word that marks a ledger line that takes an earlier one back. */
export const ledgerVoidText = (): string => translate("sheet.ledgerVoid")

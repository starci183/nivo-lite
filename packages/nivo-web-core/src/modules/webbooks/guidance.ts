import { webbooksCopy, webbooksText } from "./copy"
import { WEBBOOKS } from "./declaration"

/**
 * The words the Accounting agent works under, in front of every model call of its steps: its craft guidance (the module's `guidance` words in `copy`), in the team's language.
 * Short on purpose: payment terms, the reminder rhythm, VAT and who signs an invoice are the company's truths (read through the truth tools); the
 * guidance only fixes what proves money, that amounts come from the CRM, and that only the invoice issue waits for the owner (a legal act) and a customer mail is a draft a person sends.
 * Empty for any other module key.
 */
export const webbooksGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    if (moduleKey !== WEBBOOKS) return ""
    return `${webbooksCopy("policy.label", locale)}: ${webbooksText("guidance")[locale]}`
}

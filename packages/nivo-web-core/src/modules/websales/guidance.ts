import { websalesCopy, websalesText } from "./copy"
import { WEBSALES } from "./declaration"

/**
 * The words the Sales agent works under, in front of every model call of its steps: its craft guidance (the module's `guidance` words in `copy`), in the team's language. It
 * sends the agent to the truths (the sales policy, the packages) and to the CRM's price list for every figure, and says to ask the
 * founder in /chat when they do not say; it holds no number, date or price of its own. Empty for any other module key.
 */
export const websalesGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    if (moduleKey !== WEBSALES) return ""
    return `${websalesCopy("policy.label", locale)}: ${websalesText("guidance")[locale]}`
}

import { webrenewCopy, webrenewText } from "./copy"
import { WEBRENEW } from "./declaration"

/**
 * The words the Renewal agent works under, in front of every model call of its steps: its craft guidance (the module's `guidance` words in `copy`), in the team's language. It
 * names the truths to read (renewal rules, price list, bank details, who wants to look at a renewal first) and says to stop and ask the founder in /chat when they
 * are missing; it holds no number, date or price of its own. Empty for any other module key.
 */
export const webrenewGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    if (moduleKey !== WEBRENEW) return ""
    return `${webrenewCopy("policy.label", locale)}: ${webrenewText("guidance")[locale]}`
}

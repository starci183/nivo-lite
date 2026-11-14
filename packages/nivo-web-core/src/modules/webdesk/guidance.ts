import { webdeskCopy, webdeskText } from "./copy"
import { WEBDESK } from "./declaration"

/**
 * The words the Support agent works under, in front of every model call of its steps: its craft guidance (the module's `guidance` words in `copy`), in the team's language. What
 * is covered, what costs what and when the company answers are the company's truths (read through the truth tools); the guidance says
 * where to look, that a customer gets nothing invented, and that the agent proposes and never acts on a host or a site. Empty for any
 * other module key.
 */
export const webdeskGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    if (moduleKey !== WEBDESK) return ""
    return `${webdeskCopy("policy.label", locale)}: ${webdeskText("guidance")[locale]}`
}

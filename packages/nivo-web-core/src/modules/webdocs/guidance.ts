import { webdocsCopy, webdocsText } from "./copy"
import { WEBDOCS } from "./declaration"

/**
 * The words the Paperwork agent works under, in front of every model call of its steps: its craft guidance (the module's `guidance` words in `copy`), in the team's language. It
 * is short on purpose: it says what the agent never does (file, sign, send, change), that a draft comes only from what it read and
 * names its sources, and whom to ask. Empty for any other module key.
 */
export const webdocsGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    if (moduleKey !== WEBDOCS) return ""
    return `${webdocsCopy("policy.label", locale)}: ${webdocsText("guidance")[locale]}`
}

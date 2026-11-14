import { webmailCopy, webmailText } from "./copy"
import { WEBMAIL } from "./declaration"

/**
 * The words the Mailbox agent works under, in front of every model call of its steps: its craft guidance (the module's `guidance` words in `copy`), in the team's language. It
 * is short on purpose: what needs a person is the company's truths (read through the truth tools), and the guidance only says where to
 * look and what to report while no truth says. Empty for any other module key.
 */
export const webmailGuidanceOf = (moduleKey: string, locale: "vi" | "en"): string => {
    if (moduleKey !== WEBMAIL) return ""
    return `${webmailCopy("policy.label", locale)}: ${webmailText("guidance")[locale]}`
}

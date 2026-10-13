import type { LocalizedText } from "../automation-templates.contracts"
import { AutomationTemplatesError, AutomationTemplatesErrorCode } from "../errors/automation-templates.error"
import { AUTOMATION_TEMPLATES_MESSAGES } from "../messages/automation-templates.messages"

/** Reads the words of a template from the messages catalog by key, in both languages; a key with no text is a defect of the catalogue. */
export const text = (key: string): LocalizedText => {
    const vi = AUTOMATION_TEMPLATES_MESSAGES.vi[key]
    const en = AUTOMATION_TEMPLATES_MESSAGES.en[key]
    if (vi === undefined || en === undefined) {
        throw new AutomationTemplatesError({
            code: AutomationTemplatesErrorCode.DefinitionInvalid,
            params: { key, field: "text" },
        })
    }
    return { vi, en }
}

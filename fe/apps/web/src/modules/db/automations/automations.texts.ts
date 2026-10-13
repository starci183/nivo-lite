import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import type { AutomationsLanguages, AutomationsTexts } from "./automations.view"

const textsOf =
    (messages: Readonly<Record<string, string>>): AutomationsTexts =>
    (key, values = {}) =>
        Object.entries(values).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, value),
            messages[key] ?? key,
        )

/** The automations messages in both languages: the labels, the patterns that read a shop and the lines of evidence. */
export const AUTOMATIONS_LANGUAGES: AutomationsLanguages = {
    vi: textsOf(allVi.automations),
    en: textsOf(allEn.automations),
}

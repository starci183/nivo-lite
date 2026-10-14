import { CONTEXT_NOTES_MESSAGES } from "@modules/domain/module-context-notes"
import type { MessageBundle } from "@modules/platform/i18n"
import vi from "./vi.json"
import en from "./en.json"

/** Module catalog, error and setup messages, including the context-note codes. */
export const MODULES_MESSAGES: MessageBundle = {
    vi: { ...CONTEXT_NOTES_MESSAGES.vi, ...vi },
    en: { ...CONTEXT_NOTES_MESSAGES.en, ...en },
}

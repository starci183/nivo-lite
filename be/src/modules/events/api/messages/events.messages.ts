import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the events codes, Vietnamese and English. */
export const EVENTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.EVENTS_VALUE_OUTSIDE_SET":
            "Giá trị của trường {{field}} nằm ngoài tập giá trị của sự kiện.",
    },
    en: { "errors.EVENTS_VALUE_OUTSIDE_SET": "The value of the field {{field}} is outside the values of the event." },
}

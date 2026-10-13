import type { MessageBundle } from "@modules/platform/i18n"
import { MESSAGES_TEMPLATE_MESSAGES } from "./messages.messages"
import { GROWTH_TEMPLATE_MESSAGES } from "./growth.messages"
import { BOOKING_TEMPLATE_MESSAGES } from "./booking.messages"
import { INVENTORY_TEMPLATE_MESSAGES } from "./inventory.messages"
import { LOYALTY_TEMPLATE_MESSAGES } from "./loyalty.messages"
import { SHIFTS_TEMPLATE_MESSAGES } from "./shifts.messages"
import { N8N_TEMPLATE_MESSAGES } from "./n8n.messages"

/** Display text of the automation templates codes and the catalogue texts of its templates, Vietnamese and English. */
export const AUTOMATION_TEMPLATES_MESSAGES: MessageBundle = {
    vi: {
        ...MESSAGES_TEMPLATE_MESSAGES.vi,
        ...GROWTH_TEMPLATE_MESSAGES.vi,
        ...BOOKING_TEMPLATE_MESSAGES.vi,
        ...INVENTORY_TEMPLATE_MESSAGES.vi,
        ...LOYALTY_TEMPLATE_MESSAGES.vi,
        ...SHIFTS_TEMPLATE_MESSAGES.vi,
        ...N8N_TEMPLATE_MESSAGES.vi,
        "errors.AUTOMATION_TEMPLATES_DEFINITION_INVALID": "Mẫu tự động hoá {{key}} không hợp lệ ở mục {{field}}.",
        "errors.AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN": "Không có mẫu tự động hoá này.",
    },
    en: {
        ...MESSAGES_TEMPLATE_MESSAGES.en,
        ...GROWTH_TEMPLATE_MESSAGES.en,
        ...BOOKING_TEMPLATE_MESSAGES.en,
        ...INVENTORY_TEMPLATE_MESSAGES.en,
        ...LOYALTY_TEMPLATE_MESSAGES.en,
        ...SHIFTS_TEMPLATE_MESSAGES.en,
        ...N8N_TEMPLATE_MESSAGES.en,
        "errors.AUTOMATION_TEMPLATES_DEFINITION_INVALID": "The automation template {{key}} is invalid at {{field}}.",
        "errors.AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN": "There is no such automation template.",
    },
}

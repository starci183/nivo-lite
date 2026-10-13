import type { TemplateDefinition } from "./automation-templates.contracts"
import { MESSAGES_TEMPLATES } from "./messages.templates"
import { GROWTH_TEMPLATES } from "./growth.templates"
import { BOOKING_TEMPLATES } from "./booking.templates"
import { INVENTORY_TEMPLATES } from "./inventory.templates"
import { LOYALTY_TEMPLATES } from "./loyalty.templates"
import { SHIFTS_TEMPLATES } from "./shifts.templates"
import { N8N_TEMPLATES } from "./n8n.templates"

/** The whole catalogue the cli writes into public.automation_templates; each template carries its own gallery position. */
export const TEMPLATE_CATALOG: ReadonlyArray<TemplateDefinition> = [
    ...MESSAGES_TEMPLATES,
    ...GROWTH_TEMPLATES,
    ...BOOKING_TEMPLATES,
    ...INVENTORY_TEMPLATES,
    ...LOYALTY_TEMPLATES,
    ...SHIFTS_TEMPLATES,
    ...N8N_TEMPLATES,
]

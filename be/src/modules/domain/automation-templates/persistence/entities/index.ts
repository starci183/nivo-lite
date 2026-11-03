import { AutomationTemplateEntity } from "./automation-template.entity"

export { AutomationTemplateEntity }

/** Every entity the automation-templates capability owns, collected by the database connection. */
export const automationTemplatesEntities: readonly [typeof AutomationTemplateEntity] = [
    AutomationTemplateEntity,
] as const

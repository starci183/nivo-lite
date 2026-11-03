import { AutomationCommandEntity } from "./automation-command.entity"

export { AutomationCommandEntity }

/** Every entity the automation-commands capability owns, collected by the database connection. */
export const automationCommandsEntities: readonly [typeof AutomationCommandEntity] = [AutomationCommandEntity] as const

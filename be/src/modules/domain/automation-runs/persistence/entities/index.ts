import { AutomationRunEntity } from "./automation-run.entity"

export { AutomationRunEntity }

/** Every entity the automation-runs capability owns, collected by the database connection. */
export const automationRunsEntities: readonly [typeof AutomationRunEntity] = [AutomationRunEntity] as const

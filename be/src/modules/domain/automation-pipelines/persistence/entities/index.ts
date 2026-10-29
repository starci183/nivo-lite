import { AutomationPipelineEntity } from "./automation-pipeline.entity"

export { AutomationPipelineEntity }

/** Every entity the automation-pipelines capability owns, collected by the database connection. */
export const automationPipelinesEntities = [AutomationPipelineEntity] as const

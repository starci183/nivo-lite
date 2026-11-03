import { AgentTemplateEntity } from "./agent-template.entity"
import { AgentTemplateVersionEntity } from "./agent-template-version.entity"
import { TemplateInstallEntity } from "./template-install.entity"
import { TemplateLicenseEntity } from "./template-license.entity"

export { AgentTemplateEntity, AgentTemplateVersionEntity, TemplateInstallEntity, TemplateLicenseEntity }

/** Every entity the agent-templates capability owns, collected by the database connection. */
export const agentTemplatesEntities = [
    AgentTemplateEntity,
    AgentTemplateVersionEntity,
    TemplateInstallEntity,
    TemplateLicenseEntity,
] as const

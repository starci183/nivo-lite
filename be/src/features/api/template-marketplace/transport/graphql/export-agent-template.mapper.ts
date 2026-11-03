import type { ExportAgentTemplateRequest } from "../../application/export-agent-template.contracts"
import type { TemplateVersionRefInput } from "./dto/template-version-ref.input"

/** Maps the GraphQL arguments of exportAgentTemplate to the request. */
export const toExportAgentTemplateRequest = (input: TemplateVersionRefInput): ExportAgentTemplateRequest => ({
    templateKey: input.templateKey,
    version: input.version,
})

/** Maps the answer to the GraphQL scalar. */
export const toExportAgentTemplateType = (result: string): string => result

import type { ImportAgentTemplateRequest } from "../../application/import-agent-template.contracts"
import type { InstalledTemplate } from "@nivo-lite/agent-sdk/template"
import type { ImportAgentTemplateInput } from "./dto/import-agent-template.input"
import type { InstalledTemplateType } from "./dto/installed-template.type"
import { toInstalledTemplateType, valuesOf } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of importAgentTemplate to the request. */
export const toImportAgentTemplateRequest = (
    workspaceId: string,
    input: ImportAgentTemplateInput,
): ImportAgentTemplateRequest => ({
    workspaceId,
    templateKey: input.templateKey,
    version: input.version,
    values: valuesOf(input.values),
    name: input.name ?? null,
})

/** Maps the answer to the GraphQL type. */
export const toImportAgentTemplateType = (result: InstalledTemplate): InstalledTemplateType =>
    toInstalledTemplateType(result)

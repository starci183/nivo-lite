import type { PackageAgentTemplateRequest } from "../../application/package-agent-template.contracts"
import type { TemplateVersionView } from "@nivo-lite/agent-sdk/template"
import type { PackageAgentTemplateInput } from "./dto/package-agent-template.input"
import type { TemplateVersionType } from "./dto/template-version.type"
import { toPackageRequest, toTemplateVersionType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of packageAgentTemplate to the request. */
export const toPackageAgentTemplateRequest = (
    workspaceId: string,
    input: PackageAgentTemplateInput,
): PackageAgentTemplateRequest => toPackageRequest(workspaceId, input)

/** Maps the answer to the GraphQL type. */
export const toPackageAgentTemplateType = (result: TemplateVersionView): TemplateVersionType =>
    toTemplateVersionType(result)

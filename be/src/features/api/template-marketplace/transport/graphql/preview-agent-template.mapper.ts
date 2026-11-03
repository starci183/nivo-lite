import type { PreviewAgentTemplateRequest } from "../../application/preview-agent-template.contracts"
import type { PackagePreview } from "@modules/domain/agent-templates"
import type { PackageAgentTemplateInput } from "./dto/package-agent-template.input"
import type { PackagePreviewType } from "./dto/package-preview.type"
import { toPackagePreviewType, toPackageRequest } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of agentTemplatePreview to the request. */
export const toPreviewAgentTemplateRequest = (
    workspaceId: string,
    input: PackageAgentTemplateInput,
): PreviewAgentTemplateRequest => toPackageRequest(workspaceId, input)

/** Maps the answer to the GraphQL type. */
export const toPreviewAgentTemplateType = (result: PackagePreview): PackagePreviewType => toPackagePreviewType(result)

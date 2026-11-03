import type { ForkFirstPartyTemplateRequest } from "../../application/fork-first-party-template.contracts"
import type { TemplateVersionView } from "@nivo/agent-sdk/template"
import type { ForkFirstPartyTemplateInput } from "./dto/fork-first-party-template.input"
import type { TemplateVersionType } from "./dto/template-version.type"
import { toTemplateVersionType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of forkFirstPartyTemplate to the request. */
export const toForkFirstPartyTemplateRequest = (
    workspaceId: string,
    input: ForkFirstPartyTemplateInput,
): ForkFirstPartyTemplateRequest => ({ workspaceId, sourceKey: input.sourceKey, key: input.key })

/** Maps the answer to the GraphQL type. */
export const toForkFirstPartyTemplateType = (result: TemplateVersionView): TemplateVersionType =>
    toTemplateVersionType(result)

import type { TemplateView } from "@nivo-lite/agent-sdk/template"
import type { TemplateType } from "./dto/template.type"
import { toTemplateType } from "./template-marketplace.records.mapper"

/** Maps the answer to the GraphQL type. */
export const toMyAgentTemplatesType = (result: ReadonlyArray<TemplateView>): Array<TemplateType> =>
    result.map((item) => toTemplateType(item))

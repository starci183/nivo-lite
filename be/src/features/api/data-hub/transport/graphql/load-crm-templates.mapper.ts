import type { CrmTemplateView } from "@modules/domain/data-hub"
import type { LoadCrmTemplatesRequest } from "../../application/load-crm-templates.contracts"
import type { CrmTemplateType } from "./dto/crm-template.type"

/** Builds the request of crmTemplates. */
export const toLoadCrmTemplatesRequest = (workspaceId: string): LoadCrmTemplatesRequest => ({ workspaceId })

/** Maps the templates to the GraphQL type. */
export const toCrmTemplateTypes = (templates: ReadonlyArray<CrmTemplateView>): Array<CrmTemplateType> =>
    templates.map((template) => ({ ...template, label: { vi: template.label.vi, en: template.label.en } }))

import type { InventoryTemplateInfo, InventoryWorkbenchView } from "@modules/domain/inventory"
import type { InventoryTemplatesRequest } from "../../application/inventory-templates.contracts"
import type { InventoryWorkbenchRequest } from "../../application/inventory-workbench.contracts"
import type { InventoryTemplateType } from "./dto/inventory-template.type"
import type { InventoryWorkbenchType } from "./dto/inventory-workbench.type"

/** Maps the workspace scope to the workbench request. */
export const toInventoryWorkbenchRequest = (workspaceId: string): InventoryWorkbenchRequest => ({ workspaceId })

/** Maps the workspace scope to the templates request. */
export const toInventoryTemplatesRequest = (workspaceId: string): InventoryTemplatesRequest => ({ workspaceId })

/** Maps the workbench view to the GraphQL type. */
export const toInventoryWorkbenchType = (result: InventoryWorkbenchView): InventoryWorkbenchType => result

/** Maps one starter set to the GraphQL type. */
export const toInventoryTemplateType = (result: ReadonlyArray<InventoryTemplateInfo>): Array<InventoryTemplateType> =>
    result.map((template) => ({ key: template.key, name: template.name, description: template.description }))

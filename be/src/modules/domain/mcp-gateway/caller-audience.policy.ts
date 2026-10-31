import { lensOf } from "@modules/domain/knowledge"
import { catalogAudienceOf } from "@modules/domain/module-audiences"
import type { GatewayCaller } from "./mcp-gateway.contracts"

/**
 * Who an agent of this module talks to, under the same lens policy the knowledge search uses: a customer-facing or publishing module,
 * a module the catalogue does not know, and an agent the workspace does not hold (no module) are `customer`. Default deny: only a
 * catalogued staff-facing module is `internal`.
 */
export const audienceOfModule = (module: string | null): NonNullable<GatewayCaller["audience"]> => {
    if (module === null) return "customer"
    const moduleAudience = catalogAudienceOf(module)
    if (moduleAudience === null) return "customer"
    return lensOf({ workspaceId: "", module, moduleAudience }).audience
}

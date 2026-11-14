import type { OpenApiToolsPinView } from "@modules/domain/data-hub"
import type { CrmPinType } from "./dto/crm-pin.type"

/** Maps a pin view to the GraphQL type: the operations the packages call with their state, and the other operations of the snapshot. */
export const toCrmPinType = (pin: OpenApiToolsPinView): CrmPinType => ({
    connector: pin.connector,
    swaggerUrl: pin.swaggerUrl,
    documentSha256: pin.documentSha256,
    pinnedAt: pin.pinnedAt,
    live: pin.live,
    needed: pin.tools.map((tool) => ({
        op: tool.tool,
        state: tool.state,
        method: tool.method,
        path: tool.path,
        effect: tool.effect,
    })),
    others: pin.undeclared.map((operation) => ({ op: operation.toolId, method: operation.method, path: operation.path })),
})

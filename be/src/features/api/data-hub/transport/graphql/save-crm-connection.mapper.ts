import type { CrmConnectionResult } from "@modules/domain/data-hub"
import type { SaveCrmConnectionRequest } from "../../application/save-crm-connection.contracts"
import { toCrmPinType } from "./crm-pin.mapper"
import type { CrmConnectionType } from "./dto/crm-connection.type"
import type { SaveCrmConnectionInput } from "./dto/save-crm-connection.input"

/** Maps the GraphQL arguments of saveCrmConnection to the request. */
export const toSaveCrmConnectionRequest = (
    workspaceId: string,
    input: SaveCrmConnectionInput,
): SaveCrmConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    crmId: input.crmId,
    baseUrl: input.baseUrl,
    swaggerUrl: input.swaggerUrl,
    auth:
        input.auth.type === "header"
            ? { type: "header", name: input.auth.name ?? "", value: input.auth.value }
            : { type: "bearer", value: input.auth.value },
})

/** Maps what saving came to to the GraphQL type. */
export const toCrmConnectionType = (result: CrmConnectionResult): CrmConnectionType => ({
    connectionId: result.connectionId,
    templated: result.templated,
    compatible: result.compatible,
    driftFromTemplate: [...result.driftFromTemplate],
    pin: toCrmPinType(result.pin),
})

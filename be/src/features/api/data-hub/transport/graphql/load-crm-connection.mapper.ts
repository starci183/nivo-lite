import type { CrmConnectionView } from "@modules/domain/data-hub"
import type { LoadCrmConnectionRequest } from "../../application/load-crm-connection.contracts"
import { toCrmPinType } from "./crm-pin.mapper"
import type { CrmConnectionViewType } from "./dto/crm-connection-view.type"
import type { LoadCrmConnectionInput } from "./dto/load-crm-connection.input"

/** Maps the GraphQL arguments of crmConnection to the request. */
export const toLoadCrmConnectionRequest = (
    workspaceId: string,
    input: LoadCrmConnectionInput,
): LoadCrmConnectionRequest => ({ workspaceId, connectionId: input.connectionId })

/** Maps the saved CRM connection to the GraphQL type. */
export const toCrmConnectionViewType = (view: CrmConnectionView): CrmConnectionViewType => ({
    ...view,
    pin: view.pin === null ? null : toCrmPinType(view.pin),
})

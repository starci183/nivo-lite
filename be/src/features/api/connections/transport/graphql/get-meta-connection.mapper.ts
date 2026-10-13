import type { GetMetaConnectionRequest } from "../../application/get-meta-connection.contracts"
import type { MetaWizardConnection } from "@modules/domain/meta-connections"
import type { GetMetaConnectionInput } from "./dto/get-meta-connection.input"
import type { MetaWizardConnectionType } from "./dto/meta-wizard-connection.type"

/** Maps the GraphQL arguments of metaConnection to the request. */
export const toGetMetaConnectionRequest = (
    workspaceId: string,
    input: GetMetaConnectionInput,
): GetMetaConnectionRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of metaConnection to the GraphQL type. */
export const toGetMetaConnectionType = (result: MetaWizardConnection): MetaWizardConnectionType => result

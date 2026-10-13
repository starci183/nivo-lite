import type { CheckMetaRequest } from "../../application/check-meta.contracts"
import type { MetaCheck } from "@modules/domain/meta-connections"
import type { CheckMetaInput } from "./dto/check-meta.input"
import type { MetaCheckType } from "./dto/meta-check.type"

/** Maps the GraphQL arguments of checkMeta to the request. */
export const toCheckMetaRequest = (workspaceId: string, input: CheckMetaInput): CheckMetaRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    repair: input.repair,
})

/** Maps the answer of checkMeta to the GraphQL type. */
export const toCheckMetaType = (result: MetaCheck): MetaCheckType => ({ ...result, pageSubscription: result.page })

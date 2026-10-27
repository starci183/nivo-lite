import type {
    LinkContractCustomersRequest,
    LinkContractCustomersResult,
} from "../../application/link-contract-customers.contracts"
import type { LinkContractCustomersType } from "./dto/link-contract-customers.type"

/** Maps the request context to the link command. */
export const toLinkContractCustomersRequest = (workspaceId: string): LinkContractCustomersRequest => ({ workspaceId })

/** Maps what the link did to the GraphQL type. */
export const toLinkContractCustomersType = (result: LinkContractCustomersResult): LinkContractCustomersType => ({
    linked: result.linked,
    created: result.created,
    unmatched: result.unmatched.map((contract) => ({ ...contract })),
})

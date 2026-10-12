import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListApiKeysRequest, ListApiKeysResult } from "./list-api-keys.contracts"

/** Asks for the API keys of a workspace the authenticated caller manages. */
export class ListApiKeysQuery extends Query<ListApiKeysResult> {
    constructor(readonly params: ExecuteParams<ListApiKeysRequest>) {
        super()
    }
}

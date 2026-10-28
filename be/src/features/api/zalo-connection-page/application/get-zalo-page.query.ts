import { Query } from "@nestjs/cqrs"
import type { ZaloPageView } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetZaloPageRequest } from "./get-zalo-page.contracts"

/** Asks for the page of a Zalo OA connection. */
export class GetZaloPageQuery extends Query<ZaloPageView> {
    constructor(readonly params: ExecuteParams<GetZaloPageRequest>) {
        super()
    }
}

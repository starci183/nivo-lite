import { Query } from "@nestjs/cqrs"
import type { PromoState } from "@modules/domain/promo"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PromoStateRequest } from "./promo-state.contracts"

/** Requests promoState for a workspace member. */
export class PromoStateQuery extends Query<PromoState> {
    constructor(readonly params: ExecuteParams<PromoStateRequest>) {
        super()
    }
}

import { Query } from "@nestjs/cqrs"
import type { SetupState } from "@modules/domain/modules"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetSetupStateRequest } from "./get-setup-state.contracts"

/** Asks for the setup chat of an installation: the open draft, the chat and the cards. */
export class GetSetupStateQuery extends Query<SetupState> {
    constructor(readonly params: ExecuteParams<GetSetupStateRequest>) {
        super()
    }
}

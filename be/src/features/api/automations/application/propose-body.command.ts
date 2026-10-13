import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BodyProposal } from "@modules/domain/automations"
import type { ProposeBodyRequest } from "./propose-body.contracts"

/** Proposes the shop's own wording of a template. */
export class ProposeBodyCommand extends Command<BodyProposal> {
    constructor(readonly params: ExecuteParams<ProposeBodyRequest>) {
        super()
    }
}

import { Command } from "@nestjs/cqrs"
import type { LikenessGrantView } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { VerifyTemplateLikenessRequest } from "./verify-template-likeness.contracts"

/** A platform reviewer confirms the identity of the person behind a consent record. */
export class VerifyTemplateLikenessCommand extends Command<LikenessGrantView> {
    constructor(readonly params: ExecuteParams<VerifyTemplateLikenessRequest>) {
        super()
    }
}

import { Command } from "@nestjs/cqrs"
import type { LikenessGrantView } from "@modules/domain/template-marketplace"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RecordTemplateLikenessRequest } from "./record-template-likeness.contracts"

/** Records the consent of a real person to the persona of a template of the caller. */
export class RecordTemplateLikenessCommand extends Command<LikenessGrantView> {
    constructor(readonly params: ExecuteParams<RecordTemplateLikenessRequest>) {
        super()
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { TemplateLikenessService } from "@modules/domain/template-marketplace"
import type { LikenessGrantView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RecordTemplateLikenessCommand } from "./record-template-likeness.command"

@CommandHandler(RecordTemplateLikenessCommand)
/** Records the consent of a real person to the persona of a template of the caller. */
export class RecordTemplateLikenessHandler extends ICQRSHandler<RecordTemplateLikenessCommand, LikenessGrantView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateLikenessService,
    ) {
        super(logger)
    }

    protected override process(command: RecordTemplateLikenessCommand): Promise<LikenessGrantView> {
        return this.svc.record(command.params.principal.id, command.params.request)
    }
}

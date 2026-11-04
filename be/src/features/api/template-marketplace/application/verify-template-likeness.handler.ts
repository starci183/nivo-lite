import { CommandHandler } from "@nestjs/cqrs"
import { TemplateLikenessService } from "@modules/domain/template-marketplace"
import type { LikenessGrantView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { VerifyTemplateLikenessCommand } from "./verify-template-likeness.command"

@CommandHandler(VerifyTemplateLikenessCommand)
/** A platform reviewer confirms the identity of the person behind a consent record. */
export class VerifyTemplateLikenessHandler extends ICQRSHandler<VerifyTemplateLikenessCommand, LikenessGrantView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateLikenessService,
    ) {
        super(logger)
    }

    protected override process(command: VerifyTemplateLikenessCommand): Promise<LikenessGrantView> {
        return this.svc.verify(command.params.principal, command.params.request.grantId)
    }
}

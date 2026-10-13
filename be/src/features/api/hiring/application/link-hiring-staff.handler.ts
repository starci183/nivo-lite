import { CommandHandler } from "@nestjs/cqrs"
import { HiringCandidatesService } from "@modules/domain/hiring"
import type { LinkStaffOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LinkHiringStaffCommand } from "./link-hiring-staff.command"

@CommandHandler(LinkHiringStaffCommand)
/** Create a staff profile from a hired candidate. */
export class LinkHiringStaffHandler extends ICQRSHandler<LinkHiringStaffCommand, LinkStaffOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly candidates: HiringCandidatesService,
    ) {
        super(logger)
    }

    protected override process(command: LinkHiringStaffCommand): Promise<LinkStaffOutput> {
        return this.candidates.linkStaff(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

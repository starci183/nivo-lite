import { CommandHandler } from "@nestjs/cqrs"
import { HiringCandidatesService } from "@modules/domain/hiring"
import type { MoveCandidateOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MoveHiringCandidateCommand } from "./move-hiring-candidate.command"

@CommandHandler(MoveHiringCandidateCommand)
/** Move a candidate to another stage. */
export class MoveHiringCandidateHandler extends ICQRSHandler<MoveHiringCandidateCommand, MoveCandidateOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly candidates: HiringCandidatesService,
    ) {
        super(logger)
    }

    protected override process(command: MoveHiringCandidateCommand): Promise<MoveCandidateOutput> {
        return this.candidates.move(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

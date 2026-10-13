import { CommandHandler } from "@nestjs/cqrs"
import { HiringCandidatesService } from "@modules/domain/hiring"
import type { DeleteCandidateOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteHiringCandidateCommand } from "./delete-hiring-candidate.command"

@CommandHandler(DeleteHiringCandidateCommand)
/** Delete a candidate with every trace. */
export class DeleteHiringCandidateHandler extends ICQRSHandler<DeleteHiringCandidateCommand, DeleteCandidateOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly candidates: HiringCandidatesService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteHiringCandidateCommand): Promise<DeleteCandidateOutput> {
        return this.candidates.delete(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}

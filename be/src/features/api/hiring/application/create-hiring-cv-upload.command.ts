import { Command } from "@nestjs/cqrs"
import type { HiringPublicService } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

type CreateCvUploadOutput = Awaited<ReturnType<HiringPublicService["createCvUpload"]>>

/** Asks for get a signed place to upload a CV. */
export class CreateHiringCvUploadCommand extends Command<CreateCvUploadOutput> {
    constructor(readonly params: PublicExecuteParams<Parameters<HiringPublicService["createCvUpload"]>[0]>) {
        super()
    }
}

import { CommandHandler } from "@nestjs/cqrs"
import { HiringPublicService } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateHiringCvUploadCommand } from "./create-hiring-cv-upload.command"

type CreateCvUploadOutput = Awaited<ReturnType<HiringPublicService["createCvUpload"]>>

@CommandHandler(CreateHiringCvUploadCommand)
/** Get a signed place to upload a CV. */
export class CreateHiringCvUploadHandler extends ICQRSHandler<CreateHiringCvUploadCommand, CreateCvUploadOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicService: HiringPublicService,
    ) {
        super(logger)
    }

    protected override process(command: CreateHiringCvUploadCommand): Promise<CreateCvUploadOutput> {
        return this.publicService.createCvUpload(command.params.request)
    }
}

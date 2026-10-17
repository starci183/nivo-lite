import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Credential } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { CreateHiringCvUploadCommand } from "../../application/create-hiring-cv-upload.command"
import { CreateCvUploadType } from "./dto/create-cv-upload.type"
import { CreateHiringCvUploadInput } from "./dto/create-hiring-cv-upload.input"
import { toCreateHiringCvUploadRequest, toCreateCvUploadType } from "./hiring-public.mapper"

@Resolver()
/** GraphQL door: get a signed place to upload a CV. */
export class CreateHiringCvUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Get a signed place to upload a CV. */
    @Credential({ kind: "posting", workflow: "create-hiring-cv-upload" })
    @RateLimit(RateTier.Strict)
    @Mutation(() => CreateCvUploadType, { name: "createHiringCvUpload" })
    async createHiringCvUpload(@Args("input") input: CreateHiringCvUploadInput): Promise<CreateCvUploadType> {
        const result = await this.commandBus.execute(
            new CreateHiringCvUploadCommand({ request: toCreateHiringCvUploadRequest(input) }),
        )
        return toCreateCvUploadType(result)
    }
}

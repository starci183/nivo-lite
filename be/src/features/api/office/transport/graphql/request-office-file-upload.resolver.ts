import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestOfficeFileUploadCommand } from "../../application/request-office-file-upload.command"
import { OfficeFileUploadType } from "./dto/office-file-upload.type"
import { RequestOfficeFileUploadInput } from "./dto/request-office-file-upload.input"

@Resolver()
/** The GraphQL door for requestOfficeFileUpload. */
export class RequestOfficeFileUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Issues the address a file of an Office line is uploaded to. */
    @Mutation(() => OfficeFileUploadType, { name: "requestOfficeFileUpload" })
    async requestOfficeFileUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestOfficeFileUploadInput,
    ): Promise<OfficeFileUploadType> {
        return this.commandBus.execute(
            new RequestOfficeFileUploadCommand({
                request: { workspaceId, contentType: input.contentType, sizeBytes: input.sizeBytes },
                principal,
            }),
        )
    }
}

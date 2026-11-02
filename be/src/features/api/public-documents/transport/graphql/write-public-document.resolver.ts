import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { WritePublicDocumentCommand } from "../../application/write-public-document.command"
import { WritePublicDocumentInput } from "./dto/write-public-document.input"
import { PublicDocumentType } from "./dto/public-document.type"
import { toWritePublicDocumentRequest, toWritePublicDocumentType } from "./write-public-document.mapper"

@Resolver()
/** GraphQL door of writePublicDocument. */
export class WritePublicDocumentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Writes a public document by hand; it waits for approval. */
    @Mutation(() => PublicDocumentType, { name: "writePublicDocument" })
    async writePublicDocument(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WritePublicDocumentInput,
    ): Promise<PublicDocumentType> {
        const result = await this.commandBus.execute(
            new WritePublicDocumentCommand({ request: toWritePublicDocumentRequest(workspaceId, input), principal }),
        )
        return toWritePublicDocumentType(result)
    }
}

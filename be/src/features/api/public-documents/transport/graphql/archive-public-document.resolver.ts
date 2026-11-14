import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { ArchivePublicDocumentCommand } from "../../application/archive-public-document.command"
import { PublicDocumentIdInput } from "./dto/public-document-id.input"
import { toArchivePublicDocumentRequest } from "./archive-public-document.mapper"

@Resolver()
/** GraphQL door of archivePublicDocument. */
export class ArchivePublicDocumentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Takes a public document away from customers. */
    @Mutation(() => Boolean, { name: "archivePublicDocument" })
    async archivePublicDocument(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PublicDocumentIdInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new ArchivePublicDocumentCommand({
                request: toArchivePublicDocumentRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}

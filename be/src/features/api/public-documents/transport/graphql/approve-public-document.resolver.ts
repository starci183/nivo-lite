import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApprovePublicDocumentCommand } from "../../application/approve-public-document.command"
import { ApprovePublicDocumentInput } from "./dto/approve-public-document.input"
import { PublicDocumentType } from "./dto/public-document.type"
import { toApprovePublicDocumentRequest, toApprovePublicDocumentType } from "./approve-public-document.mapper"

@Resolver()
/** GraphQL door of approvePublicDocument. */
export class ApprovePublicDocumentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves a public document and publishes it: the approver, the time and the internal sources are recorded. */
    @Mutation(() => PublicDocumentType, { name: "approvePublicDocument" })
    async approvePublicDocument(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ApprovePublicDocumentInput,
    ): Promise<PublicDocumentType> {
        const result = await this.commandBus.execute(
            new ApprovePublicDocumentCommand({
                request: toApprovePublicDocumentRequest(workspaceId, input),
                principal,
            }),
        )
        return toApprovePublicDocumentType(result)
    }
}

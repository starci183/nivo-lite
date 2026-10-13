import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CancelCommandCommand } from "../../application/cancel-command.command"
import { OfficeAckType } from "./dto/office-ack.type"
import { OfficeCandidateIdInput } from "./dto/office-candidate-id.input"
import { toCancelCommandRequest, toOfficeAckType } from "./office.mapper"

@Resolver()
/** GraphQL door that cancels a command card. */
export class CancelOfficeCommandResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Cancels a command card. */
    @Mutation(() => OfficeAckType, { name: "cancelOfficeCommand" })
    async cancelOfficeCommand(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: OfficeCandidateIdInput,
    ): Promise<OfficeAckType> {
        await this.commandBus.execute(
            new CancelCommandCommand({ request: toCancelCommandRequest(workspaceId, input), principal }),
        )
        return toOfficeAckType()
    }
}

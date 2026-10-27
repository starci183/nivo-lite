import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LinkContractCustomersCommand } from "../../application/link-contract-customers.command"
import { LinkContractCustomersType } from "./dto/link-contract-customers.type"
import { toLinkContractCustomersRequest, toLinkContractCustomersType } from "./link-contract-customers.mapper"

@Resolver()
/** GraphQL door for linking the contracts of a workspace to their customers. */
export class LinkContractCustomersResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Links every contract of the workspace to a lead the renewal can reach, for an active member of the workspace. */
    @Mutation(() => LinkContractCustomersType, { name: "linkContractCustomers" })
    async linkContractCustomers(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<LinkContractCustomersType> {
        const result = await this.commandBus.execute(
            new LinkContractCustomersCommand({ request: toLinkContractCustomersRequest(workspaceId), principal }),
        )
        return toLinkContractCustomersType(result)
    }
}

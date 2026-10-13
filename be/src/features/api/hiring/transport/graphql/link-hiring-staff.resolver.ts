import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LinkHiringStaffCommand } from "../../application/link-hiring-staff.command"
import { LinkStaffType } from "./dto/link-staff.type"
import { HiringCandidateRefInput } from "./dto/hiring-candidate-ref.input"
import { toLinkHiringStaffRequest, toLinkStaffType } from "./hiring-candidates.mapper"

@Resolver()
/** GraphQL door: create a staff profile from a hired candidate. */
export class LinkHiringStaffResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create a staff profile from a hired candidate. */
    @Mutation(() => LinkStaffType, { name: "linkHiringStaff" })
    async linkHiringStaff(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: HiringCandidateRefInput,
    ): Promise<LinkStaffType> {
        const result = await this.commandBus.execute(
            new LinkHiringStaffCommand({ request: toLinkHiringStaffRequest(workspaceId, input), principal }),
        )
        return toLinkStaffType(result)
    }
}

import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetWorkspacePlanCommand } from "../../application/set-workspace-plan.command"
import { AdminSetWorkspacePlanInput } from "./dto/admin-set-workspace-plan.input"
import { AdminPlanSetType } from "./dto/admin-plan-set.type"
import { toAdminSetWorkspacePlanRequest, toAdminPlanSetType } from "./admin-set-workspace-plan.mapper"

@Resolver()
/** GraphQL door of adminSetWorkspacePlan. */
export class AdminSetWorkspacePlanResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Moves a workspace to another plan and sets its own monthly credit allowance. */
    @Mutation(() => AdminPlanSetType, { name: "adminSetWorkspacePlan" })
    async adminSetWorkspacePlan(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AdminSetWorkspacePlanInput,
    ): Promise<AdminPlanSetType> {
        const result = await this.commandBus.execute(
            new SetWorkspacePlanCommand({ request: toAdminSetWorkspacePlanRequest(input), principal }),
        )
        return toAdminPlanSetType(result)
    }
}

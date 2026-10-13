import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ProposeShiftsWeekCommand } from "../../application/propose-shifts-week.command"
import { ProposeWeekType } from "./dto/propose-week.type"
import { ProposeShiftsWeekInput } from "./dto/propose-shifts-week.input"
import { toProposeShiftsWeekRequest, toProposeWeekType } from "./shifts-schedule.mapper"

@Resolver()
/** GraphQL door: build a draft schedule for the week that contains a day. */
export class ProposeShiftsWeekResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Build a draft schedule for the week that contains a day. */
    @Mutation(() => ProposeWeekType, { name: "proposeShiftsWeek" })
    async proposeShiftsWeek(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ProposeShiftsWeekInput,
    ): Promise<ProposeWeekType> {
        const result = await this.commandBus.execute(
            new ProposeShiftsWeekCommand({ request: toProposeShiftsWeekRequest(workspaceId, input), principal }),
        )
        return toProposeWeekType(result)
    }
}

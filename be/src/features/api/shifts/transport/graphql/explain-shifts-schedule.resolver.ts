import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ExplainShiftsScheduleCommand } from "../../application/explain-shifts-schedule.command"
import { ExplainScheduleType } from "./dto/explain-schedule.type"
import { ShiftsScheduleRefInput } from "./dto/shifts-schedule-ref.input"
import { toExplainShiftsScheduleRequest, toExplainScheduleType } from "./shifts-schedule.mapper"

@Resolver()
/** GraphQL door: write the explanation of a schedule again. */
export class ExplainShiftsScheduleResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Write the explanation of a schedule again. */
    @Mutation(() => ExplainScheduleType, { name: "explainShiftsSchedule" })
    async explainShiftsSchedule(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShiftsScheduleRefInput,
    ): Promise<ExplainScheduleType> {
        const result = await this.commandBus.execute(
            new ExplainShiftsScheduleCommand({
                request: toExplainShiftsScheduleRequest(workspaceId, input),
                principal,
            }),
        )
        return toExplainScheduleType(result)
    }
}

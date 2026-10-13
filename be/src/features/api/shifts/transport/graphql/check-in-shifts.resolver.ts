import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckInShiftsCommand } from "../../application/check-in-shifts.command"
import { CheckInType } from "./dto/check-in.type"
import { ShiftsShiftRefInput } from "./dto/shifts-shift-ref.input"
import { toCheckInShiftsRequest, toCheckInType } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: check in to the caller's shift. */
export class CheckInShiftsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Check in to the caller's shift. */
    @Mutation(() => CheckInType, { name: "checkInShifts" })
    async checkInShifts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShiftsShiftRefInput,
    ): Promise<CheckInType> {
        const result = await this.commandBus.execute(
            new CheckInShiftsCommand({ request: toCheckInShiftsRequest(workspaceId, input), principal }),
        )
        return toCheckInType(result)
    }
}

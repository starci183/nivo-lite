import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MarkNoShowCommand } from "../../application/mark-no-show.command"
import { toMarkBookingNoShowRequest, toMarkBookingNoShowType } from "./mark-booking-no-show.mapper"
import { MarkBookingNoShowInput } from "./dto/mark-booking-no-show.input"
import { MarkBookingNoShowType } from "./dto/mark-booking-no-show.type"

@Resolver()
/** GraphQL door for mark booking no show. */
export class MarkBookingNoShowResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies mark booking no show for the selected workspace. */
    @Mutation(() => MarkBookingNoShowType, { name: "markBookingNoShow" })
    async markBookingNoShow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MarkBookingNoShowInput,
    ): Promise<MarkBookingNoShowType> {
        const result = await this.commandBus.execute(
            new MarkNoShowCommand({ request: toMarkBookingNoShowRequest(workspaceId, input), principal }),
        )
        return toMarkBookingNoShowType(result)
    }
}

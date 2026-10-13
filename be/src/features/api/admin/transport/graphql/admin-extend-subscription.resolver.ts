import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ExtendSubscriptionCommand } from "../../application/extend-subscription.command"
import { AdminExtendSubscriptionInput } from "./dto/admin-extend-subscription.input"
import { AdminSubscriptionExtendedType } from "./dto/admin-subscription-extended.type"
import { toAdminExtendSubscriptionRequest, toAdminSubscriptionExtendedType } from "./admin-extend-subscription.mapper"

@Resolver()
/** GraphQL door of adminExtendSubscription. */
export class AdminExtendSubscriptionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Extends a workspace subscription by a number of days. */
    @Mutation(() => AdminSubscriptionExtendedType, { name: "adminExtendSubscription" })
    async adminExtendSubscription(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AdminExtendSubscriptionInput,
    ): Promise<AdminSubscriptionExtendedType> {
        const result = await this.commandBus.execute(
            new ExtendSubscriptionCommand({ request: toAdminExtendSubscriptionRequest(input), principal }),
        )
        return toAdminSubscriptionExtendedType(result)
    }
}

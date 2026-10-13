import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { MarkOrderShippedCommand } from "../../application/mark-order-shipped.command"
import { toMarkOrderShippedRequest, toMarkOrderShippedType } from "./mark-order-shipped.mapper"
import { MarkOrderShippedInput } from "./dto/mark-order-shipped.input"
import { MarkOrderShippedType } from "./dto/mark-order-shipped.type"

@Resolver()
/** The GraphQL door of markOrderShipped. */
export class MarkOrderShippedResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Records an order shipment. */
    @Mutation(() => MarkOrderShippedType, { name: "markOrderShipped" })
    async markOrderShipped(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: MarkOrderShippedInput,
    ): Promise<MarkOrderShippedType> {
        const result = await this.commandBus.execute(
            new MarkOrderShippedCommand({ request: toMarkOrderShippedRequest(workspaceId, locale, input), principal }),
        )
        return toMarkOrderShippedType(result)
    }
}

import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetMoneyConnectionQuery } from "../../application/get-money-connection.query"
import { GetMoneyConnectionInput } from "./dto/get-money-connection.input"
import { WizardConnectionType } from "./dto/wizard-connection.type"
import { toGetMoneyConnectionRequest, toGetMoneyConnectionType } from "./get-money-connection.mapper"

@Resolver()
/** GraphQL door of moneyConnection. */
export class GetMoneyConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the wizard view of a bank or payment feed. */
    @Query(() => WizardConnectionType, { name: "moneyConnection" })
    async moneyConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetMoneyConnectionInput,
    ): Promise<WizardConnectionType> {
        const result = await this.queryBus.execute(
            new GetMoneyConnectionQuery({ request: toGetMoneyConnectionRequest(workspaceId, input), principal }),
        )
        return toGetMoneyConnectionType(result)
    }
}

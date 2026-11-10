import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetDefaultReceivingAccountCommand } from "../../application/set-default-receiving-account.command"
import { SetDefaultReceivingAccountInput } from "./dto/set-default-receiving-account.input"
import { toMcpDone } from "./mcp-gateway.mapper"

@Resolver()
/** GraphQL door of setDefaultReceivingAccount. */
export class SetDefaultReceivingAccountResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Names the payment account the shop receives money on by default (owner only): a payment QR is drawn on it. */
    @Mutation(() => Boolean, { name: "setDefaultReceivingAccount" })
    async setDefaultReceivingAccount(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetDefaultReceivingAccountInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetDefaultReceivingAccountCommand({
                request: { workspaceId, connectionId: input.connectionId },
                principal,
            }),
        )
        return toMcpDone()
    }
}

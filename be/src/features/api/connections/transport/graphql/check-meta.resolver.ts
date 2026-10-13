import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckMetaCommand } from "../../application/check-meta.command"
import { CheckMetaInput } from "./dto/check-meta.input"
import { MetaCheckType } from "./dto/meta-check.type"
import { toCheckMetaRequest, toCheckMetaType } from "./check-meta.mapper"

@Resolver()
/** GraphQL door of checkMeta. */
export class CheckMetaResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks Meta what it knows about a connection, optionally repairing the subscriptions. */
    @Mutation(() => MetaCheckType, { name: "checkMeta" })
    async checkMeta(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CheckMetaInput,
    ): Promise<MetaCheckType> {
        const result = await this.commandBus.execute(
            new CheckMetaCommand({ request: toCheckMetaRequest(workspaceId, input), principal }),
        )
        return toCheckMetaType(result)
    }
}

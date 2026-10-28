import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SendZaloTestCommand } from "../../application/send-zalo-test.command"
import { SendZaloTestInput } from "./dto/send-zalo-test.input"
import { ZaloTestSendType } from "./dto/zalo-test-send.type"
import { toSendZaloTestRequest, toSendZaloTestType } from "./send-zalo-test.mapper"

@Resolver()
/** GraphQL door of sendZaloTestMessage. */
export class SendZaloTestResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks for a real test text to a Zalo follower. */
    @Mutation(() => ZaloTestSendType, { name: "sendZaloTestMessage" })
    async sendZaloTestMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SendZaloTestInput,
    ): Promise<ZaloTestSendType> {
        const result = await this.commandBus.execute(
            new SendZaloTestCommand({ request: toSendZaloTestRequest(workspaceId, input), principal }),
        )
        return toSendZaloTestType(result)
    }
}

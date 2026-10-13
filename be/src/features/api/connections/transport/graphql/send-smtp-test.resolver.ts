import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SendSmtpTestCommand } from "../../application/send-smtp-test.command"
import { SendSmtpTestInput } from "./dto/send-smtp-test.input"
import { SmtpTestResultType } from "./dto/smtp-test-result.type"
import { toSendSmtpTestRequest, toSendSmtpTestType } from "./send-smtp-test.mapper"

@Resolver()
/** GraphQL door of sendSmtpTest. */
export class SendSmtpTestResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sends a real test email through an SMTP connection. */
    @Mutation(() => SmtpTestResultType, { name: "sendSmtpTest" })
    async sendSmtpTest(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SendSmtpTestInput,
    ): Promise<SmtpTestResultType> {
        const result = await this.commandBus.execute(
            new SendSmtpTestCommand({ request: toSendSmtpTestRequest(workspaceId, input), principal }),
        )
        return toSendSmtpTestType(result)
    }
}

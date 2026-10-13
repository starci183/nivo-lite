import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { RecordOutcomeCommand } from "../../application/record-outcome.command"
import { RecordOutcomeInput } from "./dto/record-outcome.input"
import { RecordOutcomeType } from "./dto/record-outcome.type"
import { toRecordOutcomeRequest, toRecordOutcomeType } from "./record-outcome.mapper"

@Resolver()
/** GraphQL door for recording a lead outcome. */
export class RecordOutcomeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Records a lead stage with evidence for an active member of the workspace. */
    @Mutation(() => RecordOutcomeType, { name: "recordOutcome" })
    async recordOutcome(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RecordOutcomeInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<RecordOutcomeType> {
        const result = await this.commandBus.execute(
            new RecordOutcomeCommand({
                request: toRecordOutcomeRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toRecordOutcomeType(result)
    }
}

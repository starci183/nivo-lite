import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { StopFailedStepCommand } from "../../application/stop-failed-step.command"
import { toStopFailedStepRequest, toStopFailedStepType } from "./stop-failed-step.mapper"
import { StopFailedStepInput } from "./dto/stop-failed-step.input"
import { StopFailedStepType } from "./dto/stop-failed-step.type"

@Resolver()
/** The GraphQL door of stopFailedStep. */
export class StopFailedStepResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Stops one failed Sales step. */
    @Mutation(() => StopFailedStepType, { name: "stopFailedStep" })
    async stopFailedStep(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: StopFailedStepInput,
    ): Promise<StopFailedStepType> {
        const result = await this.commandBus.execute(
            new StopFailedStepCommand({ request: toStopFailedStepRequest(workspaceId, locale, input), principal }),
        )
        return toStopFailedStepType(result)
    }
}

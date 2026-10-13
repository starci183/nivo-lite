import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ToggleHiringOnboardingCommand } from "../../application/toggle-hiring-onboarding.command"
import { ToggleHiringOnboardingInput } from "./dto/toggle-hiring-onboarding.input"
import { toToggleHiringOnboardingRequest } from "./hiring-candidates.mapper"

@Resolver()
/** GraphQL door: tick or untick an onboarding item. */
export class ToggleHiringOnboardingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Tick or untick an onboarding item. */
    @Mutation(() => Boolean, { name: "toggleHiringOnboarding" })
    async toggleHiringOnboarding(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ToggleHiringOnboardingInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new ToggleHiringOnboardingCommand({
                request: toToggleHiringOnboardingRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}

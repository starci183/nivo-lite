import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideAgentRunStepCommand } from "../../application/decide-agent-run-step.command"
import type { AgentRunVerdict } from "../../application/decide-agent-run-step.contracts"
import { DecideAgentRunStepInput } from "./dto/decide-agent-run-step.input"
import { DecideAgentRunStepType } from "./dto/decide-agent-run-step.type"

@Resolver()
/** GraphQL door that answers the decision a run waits on from the run page; the seat is proved by the handler. */
export class AgentRunDecisionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves, retries or refuses the decision a run waits on, through the doors the inbox and the chat cards use. */
    @Mutation(() => DecideAgentRunStepType, { name: "decideAgentRunStep" })
    async decideAgentRunStep(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DecideAgentRunStepInput,
    ): Promise<DecideAgentRunStepType> {
        const outcome = await this.commandBus.execute(
            new DecideAgentRunStepCommand({
                request: {
                    workspaceId,
                    installationId: input.installationId,
                    runId: input.runId,
                    verdict: input.verdict as AgentRunVerdict,
                    stepKey: input.stepKey ?? null,
                    locale,
                },
                principal,
            }),
        )
        return { ok: outcome.ok, refusal: outcome.refusal }
    }
}

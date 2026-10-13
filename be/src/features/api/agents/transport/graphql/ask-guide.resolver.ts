import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { AskGuideCommand } from "../../application/ask-guide.command"
import { toAskGuideRequest, toGuideAskedType } from "./ask-guide.mapper"
import { AskGuideInput } from "./dto/ask-guide.input"
import { GuideAskedType } from "./dto/guide-asked.type"

@Resolver()
/** GraphQL door of the NIVO guide. */
export class AskGuideResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues the guide's answer to one question (prompt built on the be, limited per member); poll it with `agentGenerationStatus`. */
    @Mutation(() => GuideAskedType, { name: "askGuide" })
    async askGuide(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: AskGuideInput,
    ): Promise<GuideAskedType> {
        const result = await this.commandBus.execute(
            new AskGuideCommand({ request: toAskGuideRequest(workspaceId, input, locale), principal }),
        )
        return toGuideAskedType(result)
    }
}

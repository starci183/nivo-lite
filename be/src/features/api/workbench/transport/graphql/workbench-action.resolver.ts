import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { AcceptedLocale, type Locale } from "@modules/platform/i18n"
import { WorkbenchActionCommand } from "../../application/workbench-action.command"
import { WorkbenchActionInput } from "./dto/workbench-action.input"
import { WorkbenchAnswerType } from "./dto/workbench-answer.type"
import { toWorkbenchActionRequest, toWorkbenchAnswerType } from "./workbench.mapper"

@Resolver()
/** GraphQL door of the workbench actions. */
export class WorkbenchActionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs an action of a module for the selected workspace. */
    @Mutation(() => WorkbenchAnswerType, { name: "workbenchAction" })
    async workbenchAction(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: WorkbenchActionInput,
    ): Promise<WorkbenchAnswerType> {
        const answer = await this.commandBus.execute(
            new WorkbenchActionCommand({ request: toWorkbenchActionRequest(workspaceId, input, locale), principal }),
        )
        return toWorkbenchAnswerType(answer)
    }
}

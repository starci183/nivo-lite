import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { WorkbenchReadQuery } from "../../application/workbench-read.query"
import { WorkbenchAnswerType } from "./dto/workbench-answer.type"
import { WorkbenchReadInput } from "./dto/workbench-read.input"
import { toWorkbenchAnswerType, toWorkbenchReadRequest } from "./workbench.mapper"

@Resolver()
/** GraphQL door of the workbench reads. */
export class WorkbenchReadResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Runs a read of a module for the selected workspace. */
    @Query(() => WorkbenchAnswerType, { name: "workbenchRead" })
    async workbenchRead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: WorkbenchReadInput,
    ): Promise<WorkbenchAnswerType> {
        const answer = await this.queryBus.execute(
            new WorkbenchReadQuery({ request: toWorkbenchReadRequest(workspaceId, input, locale), principal }),
        )
        return toWorkbenchAnswerType(answer)
    }
}

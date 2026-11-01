import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BrainTodoQuery } from "../../application/brain-todo.query"
import { BrainTodoType } from "./dto/brain-todo.type"
import { toBrainTodoRequest, toBrainTodoType } from "./brain-todo.mapper"

@Resolver()
/** GraphQL door of the count of what needs the owner in the Second Brain. */
export class BrainTodoResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What needs the owner, as three counts and their sum; any member may read it, and the facts and questions count only for an owner or manager. */
    @Query(() => BrainTodoType, { name: "brainTodo" })
    async brainTodo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<BrainTodoType> {
        const result = await this.queryBus.execute(
            new BrainTodoQuery({ request: toBrainTodoRequest(workspaceId), principal }),
        )
        return toBrainTodoType(result)
    }
}

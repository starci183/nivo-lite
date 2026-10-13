import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ContextNotesQuery } from "../../application/context-notes.query"
import { toContextNotesRequest, toContextNotesType } from "./context-notes.mapper"
import { ContextNoteType } from "./dto/context-note.type"
import { ContextNotesInput } from "./dto/context-notes.input"

@Resolver()
/** GraphQL door of the pending context notes of an installation. */
export class ContextNotesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the notes from Office waiting for approval on one installation; a manager only. */
    @Query(() => [ContextNoteType], { name: "contextNotes" })
    async contextNotes(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ContextNotesInput,
    ): Promise<Array<ContextNoteType>> {
        const result = await this.queryBus.execute(
            new ContextNotesQuery({ request: toContextNotesRequest(workspaceId, input), principal }),
        )
        return toContextNotesType(result)
    }
}

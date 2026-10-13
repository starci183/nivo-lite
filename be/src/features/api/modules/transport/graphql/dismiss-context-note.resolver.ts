import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DismissContextNoteCommand } from "../../application/dismiss-context-note.command"
import { toDismissContextNoteRequest } from "./dismiss-context-note.mapper"
import { DismissContextNoteInput } from "./dto/dismiss-context-note.input"

@Resolver()
/** GraphQL door that dismisses a pending context note. */
export class DismissContextNoteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dismisses a note: it leaves the list and its fact leaves the current draft; a manager only. */
    @Mutation(() => Boolean, { name: "dismissContextNote" })
    async dismissContextNote(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DismissContextNoteInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DismissContextNoteCommand({ request: toDismissContextNoteRequest(workspaceId, input), principal }),
        )
        return true
    }
}

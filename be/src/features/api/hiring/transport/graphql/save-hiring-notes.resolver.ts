import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveHiringNotesCommand } from "../../application/save-hiring-notes.command"
import { SaveHiringNotesInput } from "./dto/save-hiring-notes.input"
import { toSaveHiringNotesRequest } from "./hiring-candidates.mapper"

@Resolver()
/** GraphQL door: save the notes about a candidate. */
export class SaveHiringNotesResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Save the notes about a candidate. */
    @Mutation(() => Boolean, { name: "saveHiringNotes" })
    async saveHiringNotes(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveHiringNotesInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SaveHiringNotesCommand({ request: toSaveHiringNotesRequest(workspaceId, input), principal }),
        )
        return true
    }
}

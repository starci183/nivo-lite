import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ImportInventoryPasteCommand } from "../../application/import-inventory-paste.command"
import { ImportPasteType } from "./dto/import-paste.type"
import { ImportInventoryPasteInput } from "./dto/import-inventory-paste.input"
import { toImportInventoryPasteRequest, toImportPasteType } from "./inventory-import.mapper"

@Resolver()
/** GraphQL door: import catalogue items from a pasted table. */
export class ImportInventoryPasteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Import catalogue items from a pasted table. */
    @Mutation(() => ImportPasteType, { name: "importInventoryPaste" })
    async importInventoryPaste(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ImportInventoryPasteInput,
    ): Promise<ImportPasteType> {
        const result = await this.commandBus.execute(
            new ImportInventoryPasteCommand({ request: toImportInventoryPasteRequest(workspaceId, input), principal }),
        )
        return toImportPasteType(result)
    }
}

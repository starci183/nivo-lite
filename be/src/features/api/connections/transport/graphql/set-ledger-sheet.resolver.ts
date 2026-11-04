import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetLedgerSheetCommand } from "../../application/set-ledger-sheet.command"
import { GoogleLedgerType } from "./dto/google-state.type"
import { SetLedgerSheetInput } from "./dto/set-ledger-sheet.input"
import { toSetLedgerSheetRequest, toSetLedgerSheetType } from "./set-ledger-sheet.mapper"

@Resolver()
/** GraphQL door of setLedgerSheet. */
export class SetLedgerSheetResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Names the Google spreadsheet the ledger is written to. */
    @Mutation(() => GoogleLedgerType, { name: "setLedgerSheet" })
    async setLedgerSheet(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetLedgerSheetInput,
    ): Promise<GoogleLedgerType> {
        const result = await this.commandBus.execute(
            new SetLedgerSheetCommand({ request: toSetLedgerSheetRequest(workspaceId, input), principal }),
        )
        return toSetLedgerSheetType(result)
    }
}

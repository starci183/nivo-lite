import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApplyShiftsImportCommand } from "../../application/apply-shifts-import.command"
import { ApplyImportType } from "./dto/apply-import.type"
import { ApplyShiftsImportInput } from "./dto/apply-shifts-import.input"
import { toApplyShiftsImportRequest, toApplyImportType } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: read the quick import text and set the shop up from it. */
export class ApplyShiftsImportResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Read the quick import text and set the shop up from it. */
    @Mutation(() => ApplyImportType, { name: "applyShiftsImport" })
    async applyShiftsImport(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ApplyShiftsImportInput,
    ): Promise<ApplyImportType> {
        const result = await this.commandBus.execute(
            new ApplyShiftsImportCommand({ request: toApplyShiftsImportRequest(workspaceId, input), principal }),
        )
        return toApplyImportType(result)
    }
}

import { Body, Controller, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentMember, WorkspaceRoles } from "@modules/domain/workspaces"
import type { WorkspaceMember } from "@modules/domain/workspaces"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RecordOutcomeCommand } from "../../application/record-outcome.command"
import { RecordOutcomeRequest } from "./dto/record-outcome.request"
import { RecordOutcomeResponse } from "./dto/record-outcome.response"
import { toRecordOutcomeRequest, toRecordOutcomeResponse } from "./record-outcome.mapper"

@Controller("leads")
/** HTTP door of record-outcome. */
export class RecordOutcomeController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Records the stage a lead moved to with its evidence, for any active member of the workspace. */
    @Post(":leadId/outcome")
    @WorkspaceRoles()
    async recordOutcome(
        @CurrentPrincipal() principal: Principal,
        @CurrentMember() member: WorkspaceMember,
        @Param("leadId", ParseUUIDPipe) leadId: string,
        @Body() input: RecordOutcomeRequest,
        @Headers("accept-language") acceptLanguage: string | undefined,
    ): Promise<RecordOutcomeResponse> {
        const result = await this.commandBus.execute(
            new RecordOutcomeCommand({
                request: toRecordOutcomeRequest(member, leadId, input, acceptLanguage),
                principal,
            }),
        )
        return toRecordOutcomeResponse(result)
    }
}

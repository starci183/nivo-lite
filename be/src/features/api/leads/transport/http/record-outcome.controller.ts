import { Body, Controller, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
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
    async recordOutcome(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param("leadId", ParseUUIDPipe) leadId: string,
        @Body() input: RecordOutcomeRequest,
        @Headers("accept-language") acceptLanguage: string | undefined,
    ): Promise<RecordOutcomeResponse> {
        const result = await this.commandBus.execute(
            new RecordOutcomeCommand({
                request: toRecordOutcomeRequest(workspaceId, leadId, input, acceptLanguage),
                principal,
            }),
        )
        return toRecordOutcomeResponse(result)
    }
}

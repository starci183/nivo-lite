import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type {
    AutomationCard,
    AutomationRunView,
    AutomationSuggestion,
    AutomationsOverview,
    BodyProposal,
    GoogleAccount,
} from "@modules/domain/automations"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { EmitEventCommand } from "../../application/emit-event.command"
import { GetAutomationsQuery } from "../../application/get-automations.query"
import { ListGoogleAccountsQuery } from "../../application/list-google-accounts.query"
import { ListRunsQuery } from "../../application/list-runs.query"
import { ProposeBodyCommand } from "../../application/propose-body.command"
import { RunNowCommand } from "../../application/run-now.command"
import { SuggestAutomationsQuery } from "../../application/suggest-automations.query"
import { UpdatePipelineCommand } from "../../application/update-pipeline.command"
import { toEmitEventRequest, toPatchRequest } from "./automations.mapper"
import { EmitEventRequest } from "./dto/emit-event.request"
import { RunsRequest } from "./dto/runs.request"
import { SuggestionsRequest } from "./dto/suggestions.request"
import { TemplateKeyRequest } from "./dto/template-key.request"
import { UpdatePipelineRequest } from "./dto/update-pipeline.request"

@Controller("automations")
/** HTTP doors of the automations gallery of the requested workspace; the service admits owners and managers, and any member to report an event. */
export class AutomationsController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Reads the gallery, the history and the shop for previews. */
    @Get()
    overview(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AutomationsOverview> {
        return this.queryBus.execute(new GetAutomationsQuery({ request: { workspaceId }, principal }))
    }

    /** Reads the run history of the workspace, or of one template. */
    @Get("runs")
    runs(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Query() query: RunsRequest,
    ): Promise<ReadonlyArray<AutomationRunView>> {
        return this.queryBus.execute(
            new ListRunsQuery({ request: { workspaceId, templateKey: query.template }, principal }),
        )
    }

    /** Lists the Google accounts a spreadsheet automation can write with. */
    @Get("google-accounts")
    googleAccounts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ReadonlyArray<GoogleAccount>> {
        return this.queryBus.execute(new ListGoogleAccountsQuery({ request: { workspaceId }, principal }))
    }

    /** Lists the templates worth proposing for a module. */
    @Get("suggestions")
    suggestions(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Query() query: SuggestionsRequest,
    ): Promise<ReadonlyArray<AutomationSuggestion>> {
        return this.queryBus.execute(
            new SuggestAutomationsQuery({ request: { workspaceId, moduleKey: query.module }, principal }),
        )
    }

    /** Tells the engine a business event happened. */
    @Post("events")
    @HttpCode(HttpStatus.NO_CONTENT)
    emit(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: EmitEventRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new EmitEventCommand({ request: { workspaceId, event: toEmitEventRequest(input) }, principal }),
        )
    }

    /** Changes one pipeline: switch, settings, wording, hide, send by itself. */
    @Patch(":key")
    update(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: TemplateKeyRequest,
        @Body() input: UpdatePipelineRequest,
    ): Promise<AutomationCard> {
        return this.commandBus.execute(
            new UpdatePipelineCommand({
                request: { workspaceId, templateKey: params.key, patch: toPatchRequest(input) },
                principal,
            }),
        )
    }

    /** Proposes the shop's own wording of a template. */
    @Post(":key/body")
    proposeBody(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: TemplateKeyRequest,
    ): Promise<BodyProposal> {
        return this.commandBus.execute(
            new ProposeBodyCommand({ request: { workspaceId, templateKey: params.key }, principal }),
        )
    }

    /** Runs a scheduled n8n template once now. */
    @Post(":key/run")
    @HttpCode(HttpStatus.NO_CONTENT)
    runNow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: TemplateKeyRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new RunNowCommand({ request: { workspaceId, templateKey: params.key }, principal }),
        )
    }
}

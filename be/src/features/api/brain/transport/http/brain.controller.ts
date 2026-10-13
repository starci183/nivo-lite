import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DecideFactCommand } from "../../application/decide-fact.command"
import { DecideLessonCommand } from "../../application/decide-lesson.command"
import { DismissGapCommand } from "../../application/dismiss-gap.command"
import { KeepCurrentCommand } from "../../application/keep-current.command"
import { MaintainBrainCommand } from "../../application/maintain-brain.command"
import { MineLessonsCommand } from "../../application/mine-lessons.command"
import { SaveFactCommand } from "../../application/save-fact.command"
import { SaveLessonCommand } from "../../application/save-lesson.command"
import {
    toDecideFactRequest,
    toDecideLessonRequest,
    toFactResponse,
    toKeepCurrentRequest,
    toKeptResponse,
    toLessonResponse,
    toMineResponse,
    toSaveFactRequest,
    toSaveLessonRequest,
    toSavedFactResponse,
} from "./brain.mapper"
import { DecideFactRequest } from "./dto/decide-fact.request"
import { DecideLessonRequest } from "./dto/decide-lesson.request"
import { FactResponse, KeptResponse, SavedFactResponse } from "./dto/fact.response"
import { IdRequest } from "./dto/id.request"
import { KeepCurrentRequest } from "./dto/keep-current.request"
import { LessonResponse, MineResponse } from "./dto/lesson.response"
import { MineLessonsRequest } from "./dto/mine-lessons.request"
import { SaveFactRequest } from "./dto/save-fact.request"
import { SaveLessonRequest } from "./dto/save-lesson.request"

@Controller("brain")
/** HTTP doors of the second brain of the requested workspace; the services admit owner and manager (members may refresh it). */
export class BrainController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Writes a fact; what an owner or manager writes is applied at once. */
    @Post("facts")
    async saveFact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveFactRequest,
    ): Promise<SavedFactResponse> {
        const result = await this.commandBus.execute(
            new SaveFactCommand({ request: toSaveFactRequest(workspaceId, input), principal }),
        )
        return toSavedFactResponse(result)
    }

    /** Keeps the value in force and rejects every waiting value of its key. */
    @Post("facts/keep-current")
    @HttpCode(200)
    async keepCurrent(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: KeepCurrentRequest,
    ): Promise<KeptResponse> {
        const rejected = await this.commandBus.execute(
            new KeepCurrentCommand({ request: toKeepCurrentRequest(workspaceId, input), principal }),
        )
        return toKeptResponse(rejected)
    }

    /** Decides a fact: apply, reject, choose, split or retire. */
    @Post("facts/:id/decision")
    @HttpCode(200)
    async decideFact(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: IdRequest,
        @Body() input: DecideFactRequest,
    ): Promise<FactResponse> {
        const fact = await this.commandBus.execute(
            new DecideFactCommand({ request: toDecideFactRequest(workspaceId, params.id, input), principal }),
        )
        return toFactResponse(fact)
    }

    /** Writes a lesson by hand; it is applied at once. */
    @Post("lessons")
    async saveLesson(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveLessonRequest,
    ): Promise<LessonResponse> {
        const lesson = await this.commandBus.execute(
            new SaveLessonCommand({ request: toSaveLessonRequest(workspaceId, input), principal }),
        )
        return toLessonResponse(lesson)
    }

    /** Approves, turns down or retires a lesson. */
    @Post("lessons/:id/decision")
    @HttpCode(200)
    async decideLesson(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: IdRequest,
        @Body() input: DecideLessonRequest,
    ): Promise<LessonResponse> {
        const lesson = await this.commandBus.execute(
            new DecideLessonCommand({ request: toDecideLessonRequest(workspaceId, params.id, input), principal }),
        )
        return toLessonResponse(lesson)
    }

    /** Dismisses a customer question the owner does not need answered. */
    @Post("gaps/:id/dismiss")
    @HttpCode(204)
    dismissGap(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: IdRequest,
    ): Promise<void> {
        return this.commandBus.execute(new DismissGapCommand({ request: { workspaceId, id: params.id }, principal }))
    }

    /** Brings scheduled and ended facts up to date. */
    @Post("maintain")
    @HttpCode(204)
    maintain(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<void> {
        return this.commandBus.execute(new MaintainBrainCommand({ request: { workspaceId }, principal }))
    }

    /** Studies the corrections of one agent: regression cases and proposed lessons. */
    @Post("mine")
    @HttpCode(200)
    async mine(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: MineLessonsRequest,
    ): Promise<MineResponse> {
        const result = await this.commandBus.execute(
            new MineLessonsCommand({ request: { workspaceId, module: input.module }, principal }),
        )
        return toMineResponse(result)
    }
}

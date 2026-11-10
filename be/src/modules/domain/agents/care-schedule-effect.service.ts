import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL, careKindOf, careScheduleEffect, careTaskKeyOf, careTaskTitleOf, schedulable } from "@nivo-lite/blocks-core"
import type { CareSchedulePayload } from "@nivo-lite/blocks-core"
import { AgentTasksService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentsLogEvent } from "./agents.log-events"

/** The effect this executor runs. */
const CARE_SCHEDULE: string = TOOL.careSchedule

/** The kind of subject a care timer is: the task of the agent that holds it. */
const TASK = "agent-task"

const HOUR_MS = 3_600_000

/** The instant a care step is due: the one given, else the hours given after the engine's clock; null when neither is given. */
const dueAtOf = (payload: CareSchedulePayload, now: Date): string | null => {
    if (payload.dueAt !== undefined) return payload.dueAt
    if (payload.afterHours === undefined) return null
    return new Date(now.getTime() + payload.afterHours * HOUR_MS).toISOString()
}

@Injectable()
/**
 * The executor of `care.schedule`: arms a care step of the Sales agent (a payment reminder, a stale check, a check-in after delivery, a
 * suggestion before an occasion) as one task of that agent with a wake time: the instant given, or `afterHours` added to the engine's
 * clock (so an agent arming a timing of its policy types no instant). The key of the task is the step and the record, so arming
 * it again moves the same task instead of adding one, and the title carries the moment the step is really due, because a task wakes at most
 * seven days ahead and the step re-arms itself until its moment comes. The minute sweep turns a due task into a tag that starts the agent's graph.
 * A payload no schedule can hold (an unknown step, a moment that is not an instant or is more than 90 days away) is refused for good.
 */
export class CareScheduleEffectService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: string = CARE_SCHEDULE

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly tasks: AgentTasksService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /** Writes the task of the care step for the agent of the turn and answers it. */
    async execute(turn: NodeTurn, payload: EffectPayload, _call: EffectCall): Promise<SubjectRef> {
        const parsed = careScheduleEffect.payload.safeParse(payload)
        const now = this.clock.now()
        const dueAt = parsed.success ? dueAtOf(parsed.data, now) : null
        if (!parsed.success || careKindOf(parsed.data.kind) === null || dueAt === null || !schedulable(dueAt, now)) {
            throw new AgentsError({
                code: AgentsErrorCode.CareScheduleInvalid,
                params: { refusal: "EFFECT_PAYLOAD_INVALID", effect: CARE_SCHEDULE },
            })
        }
        const { kind, ref, suffix } = parsed.data
        const key = careTaskKeyOf(kind, ref, suffix ?? "")
        await this.tasks.apply(turn.workspaceId, turn.agentId, [
            { op: "add", key, title: careTaskTitleOf(dueAt), nextActionAt: new Date(dueAt) },
        ])
        this.logger.info(AgentsLogEvent.CareScheduled, { agentId: turn.agentId, kind, dueAt })
        return { kind: TASK, id: key }
    }
}

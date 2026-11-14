import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import {
    AgentTasksService,
    timerDueAtOf,
    timerDueInBounds,
    timerTaskKeyOf,
    timerTaskTitleOf,
    timerWakeAtOf,
    type AgentTaskData,
} from "@modules/domain/agent-work"
import { ConversationContactsService } from "@modules/domain/contacts"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    invalidArguments,
    unknownTool,
} from "@modules/domain/tools"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { TIMER_ARM_INPUT_SCHEMA, TIMER_ARM_SCHEMA, TIMER_CANCEL_INPUT_SCHEMA, TIMER_CANCEL_SCHEMA } from "./timer-native.schema"

/** The tool names inside the connector (the full id is `nivo.tool.<name>`). */
export const TIMER_TOOL = { arm: "timer.arm", cancel: "timer.cancel" } as const

/** The generic timers: the engine's own, on no account, named by what they do. */
export const TIMER_MANIFEST: ToolManifest = {
    key: "timer",
    namespace: "nivo.tool",
    name: "Timers",
    contractVersion: "timer-native@1",
    tools: [
        {
            name: TIMER_TOOL.arm,
            description:
                "Arms a timer: at the moment given (`dueAt`) or after `afterMinutes`, the engine wakes this agent again about the same customer with your `ref` and `data`, after the current run has ended. Arming the same `ref` again for the same customer replaces its moment. At least a minute and at most 365 days ahead.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: TIMER_ARM_INPUT_SCHEMA,
            argumentSchema: TIMER_ARM_SCHEMA,
            domain: TOOL.timerArm,
            internalOnly: true,
        },
        {
            name: TIMER_TOOL.cancel,
            description: "Cancels the timer of this `ref` for this customer; answers whether one was armed.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: TIMER_CANCEL_INPUT_SCHEMA,
            argumentSchema: TIMER_CANCEL_SCHEMA,
            domain: TOOL.timerCancel,
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * The generic timer tools: a timer is ONE task of the arming agent in the engine's task store (key = agent, subject, `ref`; no new
 * table). The subject is the run's contact, else its conversation, else none (a timer of the agent). The minute sweep turns a due task
 * into a wake that starts the agent's own graph on `nivo.trigger.timer.due` with `{ ref, data, dueAt }` and the subject. Bounds are
 * checked against the engine's clock; a moment outside them is refused as invalid arguments. No business knowledge lives here.
 */
export class TimerNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = TIMER_MANIFEST

    constructor(
        private readonly tasks: AgentTasksService,
        private readonly conversations: ConversationContactsService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Runs one timer tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        switch (tool) {
            case TIMER_TOOL.arm:
                return this.arm(workspaceId, args, caller)
            case TIMER_TOOL.cancel:
                return this.cancel(workspaceId, args, caller)
            default:
                throw unknownTool(tool)
        }
    }

    private async arm(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const asked = argumentsOf(TIMER_TOOL.arm, TIMER_ARM_SCHEMA, args)
        const now = this.clock.now()
        const due = timerDueAtOf(asked, now)
        if (due === null || !timerDueInBounds(due, now)) throw invalidArguments(TIMER_TOOL.arm)
        const subject = await this.subjectOf(workspaceId, caller)
        const dueAt = due.toISOString()
        await this.tasks.armTimer(workspaceId, caller.agentId, {
            key: timerTaskKeyOf(subject, asked.ref),
            title: timerTaskTitleOf(dueAt, subject.conversationId),
            wakeAt: timerWakeAtOf(due, now),
            data: asked.data === undefined ? null : (asked.data satisfies AgentTaskData),
        })
        return { ref: asked.ref, dueAt }
    }

    private async cancel(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const asked = argumentsOf(TIMER_TOOL.cancel, TIMER_CANCEL_SCHEMA, args)
        const subject = await this.subjectOf(workspaceId, caller)
        return { cancelled: await this.tasks.cancelTimer(caller.agentId, timerTaskKeyOf(subject, asked.ref)) }
    }

    /** Whom the run serves: its contact (the door's, else the conversation's), and its conversation. */
    private async subjectOf(workspaceId: string, caller: NativeCaller): Promise<{ readonly contactId: string | null; readonly conversationId: string | null }> {
        const conversationId = caller.conversationId
        const fromRun = caller.run?.contactId ?? null
        const contactId =
            fromRun ?? (conversationId === null ? null : await this.conversations.contactOf(workspaceId, conversationId))
        return { contactId, conversationId }
    }
}

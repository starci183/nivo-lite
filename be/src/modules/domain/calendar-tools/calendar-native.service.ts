import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { CalendarRegistryService, type CalendarEvent, type CalendarPort } from "@modules/domain/provider-registry"
import {
    CALENDAR_EVENT_CANCEL_INPUT_SCHEMA,
    CALENDAR_EVENT_CANCEL_SCHEMA,
    CALENDAR_EVENT_CREATE_INPUT_SCHEMA,
    CALENDAR_EVENT_CREATE_SCHEMA,
    CALENDAR_EVENT_UPDATE_INPUT_SCHEMA,
    CALENDAR_EVENT_UPDATE_SCHEMA,
    CALENDAR_SLOT_FREE_LIST_INPUT_SCHEMA,
    CALENDAR_SLOT_FREE_LIST_SCHEMA,
    CALENDAR_SLOTS_DEFAULT,
} from "./calendar-native.schema"
import { calendarFailureOf, calendarRefusal } from "./calendar-refusal.policy"
import { clockMinutesOf, freeSlotsOf, isoInZone, type Span } from "./calendar-slots.policy"
import { CALENDAR_TOOL_NAME } from "./calendar-tools.tool-ids"
import { DomainError } from "@modules/platform/errors"

/** The zone an answer is told in when the caller names none. */
const UTC = "UTC"

/**
 * The generic calendar tools. They are GENERIC (all three tests hold): the same intent (the shop's calendar), the same core contract
 * (a window and a slot length in; an event in, an event out) and substitutable (another calendar given the same call yields the same
 * business result), so the tool runner may fall back across calendar providers. The words are neutral (`calendarId`, `guests`).
 */
export const CALENDAR_MANIFEST: ToolManifest = {
    key: "calendar",
    namespace: "nivo.tool",
    name: "Calendar",
    contractVersion: "calendar-native@1",
    timeoutMs: 60_000,
    tools: [
        {
            name: CALENDAR_TOOL_NAME.slotFreeList,
            description:
                "The free slots of a calendar inside a window: slots of a given length, optionally only inside daily hours, computed exactly from the calendar's busy time. Answers the slots (start and end) and whether more exist.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CALENDAR_SLOT_FREE_LIST_INPUT_SCHEMA,
            argumentSchema: CALENDAR_SLOT_FREE_LIST_SCHEMA,
            domain: TOOL.calendarSlotFreeList,
            internalOnly: true,
        },
        {
            name: CALENDAR_TOOL_NAME.eventCreate,
            description:
                "Makes an event on the calendar (title, start, end, place, guests). Give your own `eventId` so a repeated call never makes two. Answers the event id and its link.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: CALENDAR_EVENT_CREATE_INPUT_SCHEMA,
            argumentSchema: CALENDAR_EVENT_CREATE_SCHEMA,
            domain: TOOL.calendarEventCreate,
            internalOnly: true,
        },
        {
            name: CALENDAR_TOOL_NAME.eventUpdate,
            description:
                "Changes an event: only what you give changes (a guest list replaces the whole list; start and end change together). Answers the event.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: CALENDAR_EVENT_UPDATE_INPUT_SCHEMA,
            argumentSchema: CALENDAR_EVENT_UPDATE_SCHEMA,
            domain: TOOL.calendarEventUpdate,
            internalOnly: true,
        },
        {
            name: CALENDAR_TOOL_NAME.eventCancel,
            description: "Cancels (removes) an event. Answers whether it was removed now or was already gone.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: CALENDAR_EVENT_CANCEL_INPUT_SCHEMA,
            argumentSchema: CALENDAR_EVENT_CANCEL_SCHEMA,
            domain: TOOL.calendarEventCancel,
            internalOnly: true,
        },
    ],
}

const answerOf = (event: CalendarEvent): ToolJson => ({
    calendarId: event.calendarId,
    eventId: event.eventId,
    status: event.status,
    link: event.link,
    summary: event.summary,
    start: event.start,
    end: event.end,
})

@Injectable()
/**
 * The generic calendar tools for internal callers, run by the provider of the account the tool runner handed the call (never a silent
 * pick: a call with no account handed is refused `not_connected`), looked up in the calendar registry by that account's provider key. The
 * free-slot arithmetic is exact code here (`freeSlotsOf`), never the provider's and never a model's.
 */
export class CalendarNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = CALENDAR_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly registry: CalendarRegistryService,
    ) {}

    /** Runs one calendar tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            return await this.run(workspaceId, tool, args, caller)
        } catch (cause) {
            const failure = calendarFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    private async run(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        switch (tool) {
            case CALENDAR_TOOL_NAME.slotFreeList:
                return this.freeSlots(workspaceId, args, caller)
            case CALENDAR_TOOL_NAME.eventCreate: {
                const asked = argumentsOf(tool, CALENDAR_EVENT_CREATE_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const zone = asked.timeZone ?? null
                const event = await port.createEvent(connection, {
                    calendarId: asked.calendarId ?? null,
                    eventId: asked.eventId ?? null,
                    summary: asked.summary,
                    description: asked.description ?? null,
                    location: asked.location ?? null,
                    start: { dateTime: asked.start, timeZone: zone },
                    end: { dateTime: asked.end, timeZone: zone },
                    guests: asked.guests ?? null,
                    notifyGuests: asked.notifyGuests ?? false,
                })
                return answerOf(event)
            }
            case CALENDAR_TOOL_NAME.eventUpdate: {
                const asked = argumentsOf(tool, CALENDAR_EVENT_UPDATE_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const zone = asked.timeZone ?? null
                const event = await port.updateEvent(connection, {
                    calendarId: asked.calendarId ?? null,
                    eventId: asked.eventId,
                    summary: asked.summary ?? null,
                    description: asked.description ?? null,
                    location: asked.location ?? null,
                    start: asked.start === undefined ? null : { dateTime: asked.start, timeZone: zone },
                    end: asked.end === undefined ? null : { dateTime: asked.end, timeZone: zone },
                    guests: asked.guests ?? null,
                    notifyGuests: asked.notifyGuests ?? false,
                })
                return answerOf(event)
            }
            case CALENDAR_TOOL_NAME.eventCancel: {
                const asked = argumentsOf(tool, CALENDAR_EVENT_CANCEL_SCHEMA, args)
                const { connection, port } = await this.accountOf(workspaceId, caller)
                const done = await port.cancelEvent(connection, {
                    calendarId: asked.calendarId ?? null,
                    eventId: asked.eventId,
                    notifyGuests: asked.notifyGuests ?? false,
                })
                return {
                    calendarId: done.calendarId,
                    eventId: done.eventId,
                    cancelled: done.cancelled,
                    alreadyCancelled: !done.cancelled,
                }
            }
            default:
                throw unknownTool(tool)
        }
    }

    /** The free slots of a window: the provider's busy ranges turned into slots by the exact arithmetic of the slots policy. */
    private async freeSlots(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const asked = argumentsOf(CALENDAR_TOOL_NAME.slotFreeList, CALENDAR_SLOT_FREE_LIST_SCHEMA, args)
        const { connection, port } = await this.accountOf(workspaceId, caller)
        const timeZone = asked.timeZone ?? UTC
        const answer = await port.busy(connection, {
            calendarId: asked.calendarId ?? null,
            windowStart: asked.windowStart,
            windowEnd: asked.windowEnd,
            timeZone: asked.timeZone ?? null,
        })
        const busy: ReadonlyArray<Span> = answer.busy.map((range) => ({
            start: Date.parse(range.start),
            end: Date.parse(range.end),
        }))
        const durationMs = asked.durationMinutes * 60_000
        const found = freeSlotsOf({
            window: { start: Date.parse(asked.windowStart), end: Date.parse(asked.windowEnd) },
            busy: busy.filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end)),
            durationMs,
            stepMs: (asked.stepMinutes ?? asked.durationMinutes) * 60_000,
            hours:
                asked.dailyHours === undefined
                    ? null
                    : {
                          fromMinutes: clockMinutesOf(asked.dailyHours.from),
                          toMinutes: clockMinutesOf(asked.dailyHours.to),
                          timeZone,
                      },
            limit: asked.limit ?? CALENDAR_SLOTS_DEFAULT,
        })
        return {
            calendarId: answer.calendarId,
            timeZone,
            slots: found.slots.map((slot) => ({
                start: isoInZone(slot.start, timeZone),
                end: isoInZone(slot.end, timeZone),
            })),
            truncated: found.truncated,
        }
    }

    /** The account the tool runner handed and its provider's calendar port: none handed, another workspace's, or no calendar port is `not_connected`. */
    private async accountOf(
        workspaceId: string,
        caller: NativeCaller,
    ): Promise<{ readonly connection: ConnectionRecord; readonly port: CalendarPort }> {
        if (caller.connectionId === undefined) throw calendarRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        const port = connection === null ? undefined : this.registry.portFor(connection)
        if (connection === null || port === undefined) throw calendarRefusal("not_connected")
        return { connection, port }
    }
}

import type { DoorPress, ScheduledItem } from "@modules/domain/agent-doors"
import type { DoorPressType } from "./dto/door-press.type"
import type { ScheduledItemType } from "./dto/scheduled-item.type"

/** Maps a press to the GraphQL type. */
export const toDoorPressType = (press: DoorPress): DoorPressType => ({
    memberId: press.memberId,
    memberName: press.memberName,
    outcome: press.outcome,
    at: press.at,
})

/** Maps a scheduled item to the GraphQL type. */
export const toScheduledItemType = (item: ScheduledItem): ScheduledItemType => ({
    id: item.id,
    kind: item.kind,
    what: item.what,
    agentId: item.agentId,
    installationId: item.installationId,
    agentName: item.agentName,
    subject: { kind: item.subject.kind, id: item.subject.id },
    dueAt: item.dueAt,
    realDueAt: item.realDueAt,
    workflow: item.workflow === null ? null : { ...item.workflow },
    stepKey: item.stepKey,
    runId: item.runId,
    lastPress: item.lastPress === null ? null : toDoorPressType(item.lastPress),
})

import assert from "node:assert/strict"
import { readResultSchema, tagDoorResultSchema } from "../../modules/domain/agent-turns/intent-step.schema"
import type { backboneInboundOf } from "./backbone-inbound.service"
import type { InboundEvent } from "../../modules/domain/agent-inbound/agent-inbound.contracts"
import { INBOUND_ACTION, INBOUND_ACTION_NODE, INBOUND_CALL_NODE } from "../fixtures/builders/backbone-inbound.builder"

/** Asserts persisted rows left by the real handlers, including the actual keys of the graph published by the builder. */
export const expectRequestOf = async (
    inbound: ReturnType<typeof backboneInboundOf>,
    event: InboundEvent,
    amount = 3_500_000,
): Promise<void> => {
    const trace = await inbound.trace(event)
    assert(trace !== null)
    expect(trace.run.versionId).toBe(inbound.who.versionId)
    expect(trace.run.context).toMatchObject({ adapter: event.adapter, idempotencyKey: event.idempotencyKey })
    expect(
        trace.steps.map((step) => ({ key: step.nodeKey, kind: step.kind, status: step.status, attempt: step.attempt })),
    ).toEqual([
        { key: INBOUND_CALL_NODE, kind: "turn", status: "done", attempt: 1 },
        { key: INBOUND_CALL_NODE, kind: "read_result", status: "done", attempt: 1 },
        {
            key: INBOUND_ACTION_NODE,
            kind: event.adapter === "tag" ? "tag_door" : "webhook_door",
            status: "done",
            attempt: 1,
        },
    ])
    const read = readResultSchema.parse(trace.steps.find((step) => step.kind === "read_result")?.result)
    expect(read.trace).toMatchObject({
        versionId: inbound.who.versionId,
        trigger: event.eventType,
        result: "picked",
        intent: INBOUND_ACTION,
    })
    const door = tagDoorResultSchema.parse(trace.steps.find((step) => step.stepKey === "door")?.result)
    assert(door.split === false)
    const items = await inbound.items()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
        action: INBOUND_ACTION,
        status: "waiting_decision",
        proposal: { fields: { amount_vnd: amount } },
    })
    expect(items[0]?.reasons).toContain("over_authority")
    expect(door.settled.actions).toEqual([
        { index: 0, action: INBOUND_ACTION, outcome: "requested", workItemId: items[0]?.id },
    ])
    expect(await inbound.replies()).toHaveLength(0)
}

import type { SimulatedInboundInput } from "@modules/domain/inbound-events"
import { InboxSimulationError, InboxSimulationErrorCode } from "./errors/inbox-simulation.error"
import type { InboxSimulationInput, SimulationStatus } from "./inbox-simulation.contracts"

/** The event fields that are persisted before the worker starts. */
export const toSimulatedInput = (workspaceId: string, input: InboxSimulationInput): SimulatedInboundInput => {
    const senderName = input.senderName.trim()
    const eventId = input.eventId?.trim() ?? ""
    const amount = input.amountVnd ?? null
    if (
        senderName.length < 2 ||
        eventId === "" ||
        (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER))
    ) {
        throw new InboxSimulationError({ code: InboxSimulationErrorCode.Invalid })
    }
    return {
        workspaceId,
        channel: input.channel,
        kind: input.kind,
        origin: "simulated",
        senderName,
        senderContact: input.senderContact?.trim() || null,
        body: input.body?.trim() ?? "",
        amountVnd: amount === null ? null : Math.round(amount),
        externalRef: input.externalRef?.trim() || null,
        eventId,
    }
}

/** Maps authoritative queue states to the polling contract; a failed work item remains a failed result even when its job returned normally. */
export const simulationStatusOf = (
    state: string | undefined,
    workStatus?: string | null,
    queued = 0,
    failed = 0,
    eventStatus?: string,
): SimulationStatus => {
    if (state === "failed" || workStatus === "failed" || failed > 0 || eventStatus === "failed") return "failed"
    if (queued > 0) return state === "running" ? "running" : "queued"
    if (state === "done") return "succeeded"
    return state === "running" ? "running" : "queued"
}

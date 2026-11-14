import type { GraphReadiness, WorkflowWire } from "@modules/domain/agent-graphs"
import type { WorkflowListWire, WorkflowReadinessWire } from "./workflow-readiness.contracts"

/** A readiness as the page reads it: every list always present, the ones that do not apply empty. */
export const readinessWireOf = (readiness: GraphReadiness): WorkflowReadinessWire => {
    const reconnect = (readiness.reconnect ?? []).map((need) => ({ provider: need.provider, connectionId: need.connectionId }))
    return readiness.hidden
        ? {
              hidden: true,
              waitingFor: [...readiness.waitingFor],
              skipped: [],
              reconnect,
              blocked: readiness.blocked.map((block) => ({
                  provider: block.provider,
                  reason: block.reason,
                  stream: block.stream ?? null,
                  connectionIds: [...(block.connectionIds ?? [])],
                  verb: block.verb ?? null,
                  tool: block.tool ?? null,
              })),
          }
        : { hidden: false, waitingFor: [], skipped: [...readiness.skipped], reconnect, blocked: [] }
}

/** The workflows of the list, each with its readiness; one whose readiness was not read carries null. */
export const withReadinessOf = (
    workflows: ReadonlyArray<WorkflowWire>,
    readiness: ReadonlyMap<string, GraphReadiness> | null,
): ReadonlyArray<WorkflowListWire> =>
    workflows.map((workflow) => {
        const read = readiness?.get(workflow.id)
        return { ...workflow, readiness: read === undefined ? null : readinessWireOf(read) }
    })

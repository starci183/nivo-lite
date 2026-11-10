import type { RoutableWorkflow } from "../agent-workflows.contracts"

/**
 * The workflow a wake from `source` goes to. Only an `active` workflow whose graph wakes on that source may take it; among those the
 * narrowest wins (the fewest sources: a workflow made for schedules takes a schedule tag before the main workflow that wakes on
 * everything), then the primary one, then the first in the list. Null when no active workflow takes the source, so the agent's own
 * graph answers the wake as before workflows existed. A draft or paused workflow never runs.
 */
export const workflowRouteOf = (workflows: ReadonlyArray<RoutableWorkflow>, source: string): string | null => {
    const takers = workflows
        .filter((workflow) => workflow.status === "active" && workflow.sources.includes(source))
        .toSorted(
            (left, right) =>
                left.sources.length - right.sources.length ||
                Number(right.primary) - Number(left.primary) ||
                left.position - right.position,
        )
    return takers.at(0)?.id ?? null
}

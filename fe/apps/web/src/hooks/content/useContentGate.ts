import type { WorkbenchGateState } from "@/hooks/workbenchGate"
import { useContentWorkbench } from "./useContentWorkbench"

/** What a block below the gate needs to be there. */
interface ContentGateNeeds {
    /** The post that must exist (its id, or the id of its decision). */
    readonly focus?: string | null
    /** Whether the member must be allowed to manage the content. */
    readonly requireManage?: boolean
}

const stateOf = (
    needs: ContentGateNeeds,
    data: ReturnType<typeof useContentWorkbench>["data"],
    error: unknown,
): WorkbenchGateState => {
    if (data === undefined) return error ? "failed" : "pending"
    if (needs.requireManage && !data.canManage) return "hidden"
    if (needs.focus === undefined) return "ready"
    return data.items.some((entry) => entry.id === needs.focus || entry.work_item_id === needs.focus)
        ? "ready"
        : "hidden"
}

/** Whether the workbench is read and holds what a block below the gate needs. */
export const useContentGate = (needs: ContentGateNeeds) => {
    const { data, error, reload } = useContentWorkbench()
    return { state: stateOf(needs, data, error), reload }
}

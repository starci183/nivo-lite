import { useContentWorkbench } from "./useContentWorkbench"

/** What a block below the gate needs to be there. */
interface ContentGateNeeds {
    /** The post that must exist (its id, or the id of its decision). */
    readonly focus?: string | null
    /** Whether the member must be allowed to manage the content. */
    readonly requireManage?: boolean
}

/** Where a gate stands: its blocks can draw, the workbench is still being read, or the blocks are not for this reader. */
type ContentGateState = "ready" | "pending" | "hidden"

/** Whether the workbench is read and holds what a block below the gate needs. */
export const useContentGate = (needs: ContentGateNeeds): ContentGateState => {
    const { data, error } = useContentWorkbench()
    if (data === undefined) return error ? "hidden" : "pending"
    if (needs.requireManage && !data.canManage) return "hidden"
    if (needs.focus === undefined) return "ready"
    return data.items.some((entry) => entry.id === needs.focus || entry.work_item_id === needs.focus)
        ? "ready"
        : "hidden"
}

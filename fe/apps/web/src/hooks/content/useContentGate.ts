import { useContentWorkbench } from "./useContentWorkbench"

/** What a block below the gate needs to be there. */
interface ContentGateNeeds {
    /** The post that must exist (its id, or the id of its decision). */
    readonly focus?: string | null
    /** Whether the member must be allowed to manage the content. */
    readonly requireManage?: boolean
}

/** Whether the workbench is read and holds what a block below the gate needs. */
export const useContentGate = (needs: ContentGateNeeds): boolean => {
    const { data } = useContentWorkbench()
    if (data === undefined) return false
    if (needs.requireManage && !data.canManage) return false
    if (needs.focus === undefined) return true
    return data.items.some((entry) => entry.id === needs.focus || entry.work_item_id === needs.focus)
}

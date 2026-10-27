import type { WorkbenchGateState } from "@/hooks/workbenchGate"
import { useVideoLibrary } from "./useVideoLibrary"

/** Whether the library and the brand kit of the video workbench are read. */
export const useVideoLibraryGate = () => {
    const library = useVideoLibrary()
    const pending: WorkbenchGateState = library.failed ? "failed" : "pending"
    const state: WorkbenchGateState = library.isReady ? "ready" : pending
    return { state, reload: library.reload }
}

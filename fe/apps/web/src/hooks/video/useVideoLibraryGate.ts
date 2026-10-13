import { useVideoLibrary } from "./useVideoLibrary"

/** Where the library gate stands: its blocks can draw, the library is still being read, or it could not be read. */
type VideoLibraryGateState = "ready" | "pending" | "hidden"

/** Whether the library and the brand kit of the video workbench are read. */
export const useVideoLibraryGate = (): VideoLibraryGateState => {
    const library = useVideoLibrary()
    if (library.isReady) return "ready"
    return library.failed ? "hidden" : "pending"
}

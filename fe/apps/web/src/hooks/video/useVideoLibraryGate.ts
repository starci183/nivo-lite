import { useVideoLibrary } from "./useVideoLibrary"

/** Whether the library and the brand kit of the video workbench are read. */
export const useVideoLibraryGate = (): boolean => useVideoLibrary().isReady

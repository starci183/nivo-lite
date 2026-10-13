import { useVideoLibrary } from "./useVideoLibrary"

/** The library for a block below the library gate, which renders it only once the library is read. */
export const useVideoLibraryData = () => {
    const library = useVideoLibrary()
    if (!library.isReady) throw new Error("The video library was read before the gate let it through")
    return library
}

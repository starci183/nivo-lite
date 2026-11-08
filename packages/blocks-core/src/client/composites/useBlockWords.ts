import { useBlockHost, useModuleNamespace, type SlotLabels } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import libraryMessages from "../../messages/vi.json"

/** The namespace of the words this library builds itself. */
const BLOCKS_NAMESPACE = "blocks"

/** The keys of the library's own words; every other key of a spec text belongs to the module that drew the spec. */
const LIBRARY_KEYS: ReadonlySet<string> = new Set(Object.keys(libraryMessages))

/** Resolves a text of a spec in the words of its module, or one of the library's own keys in the library's, in the viewer's language. */
export const useBlockWords = (): ((text: SpecText) => string) => {
    const host = useBlockHost()
    const ofLibrary = host.text(BLOCKS_NAMESPACE)
    const ofModule = host.text(useModuleNamespace())
    return (text) => ("key" in text && LIBRARY_KEYS.has(text.key) ? ofLibrary(text) : ofModule(text))
}

/** The words of the data-status recipe for one slot; the empty notice says what the block says, else the library's own words. */
export const useSlotLabels = (empty?: SpecText): SlotLabels => {
    const words = useBlockWords()
    return {
        empty: words(empty ?? { key: "slotEmpty" }),
        forbidden: words({ key: "slotForbidden" }),
        error: words({ key: "slotError" }),
        retry: words({ key: "slotRetry" }),
    }
}

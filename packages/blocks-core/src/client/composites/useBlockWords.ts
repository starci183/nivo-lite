import { useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { SlotLabels } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"

/** The namespace of the words this library builds itself. */
const BLOCKS_NAMESPACE = "blocks"

/** Resolves a text of a spec, or one of the library's own keys, in the viewer's language. */
export const useBlockWords = (): ((text: SpecText) => string) => useBlockHost().text(BLOCKS_NAMESPACE)

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

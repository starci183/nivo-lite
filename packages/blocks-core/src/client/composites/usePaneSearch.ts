import type { ParamHandle } from "@nivo-lite/agent-sdk/block"
import type { SearchFields } from "@starci/grammar/common"
import { useSearchText } from "./useSearchText"

/** What the search of a card header is told. */
export interface PaneSearchWords {
    /** The name and placeholder of the field. */
    readonly label: string
    /** The name of the clear button. */
    readonly clearLabel: string
}

/** The search zone of a card header: it keeps the text typed and writes the search param once the person pauses. */
export const usePaneSearch = (
    params: ParamHandle,
    param: string | undefined,
    words: PaneSearchWords,
): SearchFields | null => {
    const search = useSearchText(param === undefined ? null : params.value(param), (value) => {
        if (param !== undefined) params.set(param, value)
    })
    return param === undefined
        ? null
        : {
              label: words.label,
              placeholder: words.label,
              clearLabel: words.clearLabel,
              value: search.text,
              onChange: search.type,
          }
}

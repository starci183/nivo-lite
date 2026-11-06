import type { ReactNode } from "react"
import type { ParamHandle } from "@nivo-lite/agent-sdk/block"
import { SearchField } from "@starci/grammar/common"
import { useSearchText } from "./useSearchText"

/** What the search field of the pane takes. */
export interface PaneSearchProps {
    /** The name of the spec param the search writes. */
    readonly param: string
    /** The params of the page. */
    readonly params: ParamHandle
    /** The name and placeholder of the field. */
    readonly label: string
    /** The name of the clear button. */
    readonly clearLabel: string
}

/** The search field of the pane, which owns the text typed and writes the search param. */
export const PaneSearch = (props: PaneSearchProps): ReactNode => {
    const search = useSearchText(props.params.value(props.param), (value) => props.params.set(props.param, value))
    return (
        <SearchField
            label={props.label}
            isLabelHidden
            placeholder={props.label}
            clearLabel={props.clearLabel}
            value={search.text}
            onValueChange={search.type}
            onClear={search.clear}
        />
    )
}

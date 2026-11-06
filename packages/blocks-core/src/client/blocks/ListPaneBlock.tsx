import type { ReactNode } from "react"
import { SearchField, Stack } from "@starci/grammar/common"
import type { listPaneBlock } from "../../blocks/list-pane.block"
import { useBlockWords } from "../composites/useBlockWords"
import { useSearchText } from "../composites/useSearchText"
import type { RenderOf } from "../render-props"

/** What the search field of the pane takes. */
interface PaneSearchProps {
    /** The name of the spec param the search writes. */
    readonly param: string
    /** The params of the page. */
    readonly params: RenderOf<typeof listPaneBlock>["params"]
    /** The name and placeholder of the field. */
    readonly label: string
    /** The name of the clear button. */
    readonly clearLabel: string
}

/** The search field of the pane, which owns the text typed and writes the search param. */
const PaneSearch = (props: PaneSearchProps): ReactNode => {
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

/** A list pane: the search field above its filter tabs and its list. */
export const ListPaneBlock = (props: RenderOf<typeof listPaneBlock>): ReactNode => {
    const words = useBlockWords()
    const param = props.props.searchParam
    return (
        <Stack gap="row">
            {props.props.search && param !== undefined ? (
                <PaneSearch
                    param={param}
                    params={props.params}
                    label={words(props.props.searchLabel ?? { key: "searchLabel" })}
                    clearLabel={words({ key: "searchClear" })}
                />
            ) : null}
            {props.children}
        </Stack>
    )
}

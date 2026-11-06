import type { ReactNode } from "react"
import { Stack } from "@starci/grammar/common"
import type { listPaneBlock } from "../../blocks/list-pane.block"
import { PaneSearch } from "../composites/PaneSearch"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

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

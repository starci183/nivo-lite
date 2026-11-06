import { useState, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { Stack, SurfaceCard } from "@starci/grammar/common"
import type { listPaneBlock } from "../../blocks/list-pane.block"
import { paneHeadersOf } from "../../rows/pane-headers"
import { CardScopeProvider, createFilterStore } from "../composites/CardScope"
import { usePaneSearch } from "../composites/usePaneSearch"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

const NO_FILTER = (): null => null

/**
 * A list pane: one surface card whose header zones are the filter tabs (the tabs block inside it hands its tabs to the card) and the
 * search, in one toolbar row, and whose body is the list with its empty, loading and error states. The label, when it has one, stays
 * above the card on the page.
 */
export const ListPaneBlock = (props: RenderOf<typeof listPaneBlock>): ReactNode => {
    const words = useBlockWords()
    const [store] = useState(createFilterStore)
    const filter = useSyncExternalStore(store.subscribe, store.get, NO_FILTER)
    const search = usePaneSearch(props.params, props.props.search ? props.props.searchParam : undefined, {
        label: words(props.props.searchLabel ?? { key: "searchLabel" }),
        clearLabel: words({ key: "searchClear" }),
    })
    const label = words(props.props.title ?? props.props.searchLabel ?? { key: "searchLabel" })
    return (
        <SurfaceCard
            {...(props.props.title === undefined ? { ariaLabel: label } : { label, headingLevel: 3 as const })}
            headers={paneHeadersOf(filter, search)}
        >
            <CardScopeProvider value={{ filters: store }}>
                <Stack gap="row">{props.children}</Stack>
            </CardScopeProvider>
        </SurfaceCard>
    )
}

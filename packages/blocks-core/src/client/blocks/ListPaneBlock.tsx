import { Children } from "react"
import type { ReactNode } from "react"
import { Divider, Stack, SurfaceCard } from "@starci/grammar/common"
import type { listPaneBlock } from "../../blocks/list-pane.block"
import { InSurfaceProvider } from "../composites/InSurface"
import { PaneSearch } from "../composites/PaneSearch"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/**
 * A list pane: one surface card whose header is the filter tabs (the first child) then the search field, a divider, and the list
 * under it. The label, when it has one, stays above the card on the page.
 */
export const ListPaneBlock = (props: RenderOf<typeof listPaneBlock>): ReactNode => {
    const words = useBlockWords()
    const param = props.props.searchParam
    const [head, ...rest] = Children.toArray(props.children)
    const label = words(props.props.title ?? props.props.searchLabel ?? { key: "searchLabel" })
    const card = (
        <SurfaceCard
            {...(props.props.title === undefined ? { ariaLabel: label } : { label, headingLevel: 3 as const })}
        >
            <InSurfaceProvider value>
                <Stack gap="row">
                    {head}
                    {props.props.search && param !== undefined ? (
                        <PaneSearch
                            param={param}
                            params={props.params}
                            label={words(props.props.searchLabel ?? { key: "searchLabel" })}
                            clearLabel={words({ key: "searchClear" })}
                        />
                    ) : null}
                    <Divider />
                    {rest}
                </Stack>
            </InSurfaceProvider>
        </SurfaceCard>
    )
    return card
}

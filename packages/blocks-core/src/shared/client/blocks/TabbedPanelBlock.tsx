import { Children, type ReactNode } from "react"
import { SurfaceCard } from "@starci/grammar/common"
import type { tabbedPanelBlock } from "../../blocks/tabbed-panel.block"
import { selectedTabIndex } from "../../rows/tab-selection"
import { CardScopeProvider } from "../composites/CardScope"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** Child blocks under tabs: the tabs are the filter zone of one surface card and only the panel of the chosen tab is its body. */
export const TabbedPanelBlock = (props: RenderOf<typeof tabbedPanelBlock>): ReactNode => {
    const words = useBlockWords()
    const { param } = props.props
    const index = selectedTabIndex(props.props.tabs, props.params.value(param))
    const panels = Children.toArray(props.children)
    return (
        <SurfaceCard
            ariaLabel={words(props.props.label)}
            headers={[
                {
                    kind: "filter",
                    label: words(props.props.label),
                    items: props.props.tabs.map((tab) => ({ id: tab.id, label: words(tab.label) })),
                    selectedKey: props.props.tabs[index]?.id ?? "",
                    onSelect: (id) => props.params.set(param, id),
                },
            ]}
        >
            <CardScopeProvider>{panels[index] ?? null}</CardScopeProvider>
        </SurfaceCard>
    )
}

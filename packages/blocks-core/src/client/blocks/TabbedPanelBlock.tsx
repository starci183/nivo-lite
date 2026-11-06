import { Children } from "react"
import type { ReactNode } from "react"
import { Divider, Stack, SurfaceCard, Tabs } from "@starci/grammar/common"
import type { tabbedPanelBlock } from "../../blocks/tabbed-panel.block"
import { selectedTabIndex } from "../../rows/tab-selection"
import { InSurfaceProvider } from "../composites/InSurface"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** Child blocks under tabs: only the panel of the chosen tab is drawn. */
export const TabbedPanelBlock = (props: RenderOf<typeof tabbedPanelBlock>): ReactNode => {
    const words = useBlockWords()
    const { param } = props.props
    const index = selectedTabIndex(props.props.tabs, props.params.value(param))
    const panels = Children.toArray(props.children)
    return (
        <SurfaceCard ariaLabel={words(props.props.label)}>
            <Stack gap="row">
                <Tabs
                    label={words(props.props.label)}
                    items={props.props.tabs.map((tab) => ({ id: tab.id, label: words(tab.label) }))}
                    selectedKey={props.props.tabs[index]?.id ?? ""}
                    onSelect={(id) => props.params.set(param, id)}
                    inset="none"
                />
                <Divider />
                <InSurfaceProvider value>{panels[index] ?? null}</InSurfaceProvider>
            </Stack>
        </SurfaceCard>
    )
}

import { Children, useState } from "react"
import type { ReactNode } from "react"
import { Stack, Tabs } from "@starci/grammar/common"
import type { tabbedPanelBlock } from "../../blocks/tabbed-panel.block"
import { selectedTabIndex } from "../../rows/tab-selection"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** Child blocks under tabs: only the panel of the chosen tab is drawn. */
export const TabbedPanelBlock = (props: RenderOf<typeof tabbedPanelBlock>): ReactNode => {
    const words = useBlockWords()
    const [chosen, setChosen] = useState<string | null>(null)
    const index = selectedTabIndex(props.props.tabs, chosen)
    const panels = Children.toArray(props.children)
    return (
        <Stack gap="row">
            <Tabs
                label={words(props.props.label)}
                items={props.props.tabs.map((tab) => ({ id: tab.id, label: words(tab.label) }))}
                selectedKey={props.props.tabs[index]?.id ?? ""}
                onSelect={setChosen}
                inset="none"
            />
            {panels[index] ?? null}
        </Stack>
    )
}

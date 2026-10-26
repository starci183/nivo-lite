import { Tabs } from "@starci/grammar/common"

/** One tab of the Second Brain page, already worded. */
export interface BrainTabView {
    readonly id: string
    readonly label: string
}

/** Copy and state the connected tabs supply. */
export interface BrainTabsBaseProps {
    readonly props: {
        readonly label: string
        readonly tabs: ReadonlyArray<BrainTabView>
        readonly selected: string
        /** The start of the id of the panel each tab controls; the panel of the open tab carries the same id. */
        readonly panelIdPrefix: string
    }
    readonly on: { readonly select: (id: string) => void }
}

/** Draws the tabs of the Second Brain: sources, review, facts, lessons, questions and what each agent sees. */
export const BrainTabsBase = (props: BrainTabsBaseProps) => (
    <Tabs
        variant="primary"
        label={props.props.label}
        selectedKey={props.props.selected}
        inset="none"
        labelVisibility="always"
        panelId={(key) => `${props.props.panelIdPrefix}${key}`}
        items={props.props.tabs}
        onSelect={props.on.select}
    />
)

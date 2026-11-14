import { Button, type PageHeaderContent } from "@starci/grammar/common"
import type { BrainPageHeaderView } from "@/modules/types"

/** The resolved controls of the Second Brain header. */
interface BrainHeaderActionsProps {
    readonly add: BrainPageHeaderView["actions"]["add"]
}

/** Draws the add destination as a plain button (it never competes with a decision). */
export const BrainHeaderActions = (props: BrainHeaderActionsProps) =>
    props.add === null ? null : (
        <Button intent="alternative" size="sm" href={props.add.href} isDisabled={props.add.isDisabled === true}>
            {props.add.label}
        </Button>
    )

/** What the tab strip of the Second Brain header needs. */
interface BrainHeaderTabsInput {
    readonly tabs: BrainPageHeaderView["tabs"]
    readonly onSelect: (id: string) => void
}

/** The one tab strip of every Second Brain page. */
export const brainHeaderTabs = (input: BrainHeaderTabsInput): NonNullable<PageHeaderContent["tabs"]> => ({
    label: input.tabs.label,
    items: input.tabs.items,
    selectedKey: input.tabs.selectedKey,
    labelVisibility: "always",
    panelId: input.tabs.panelId,
    onSelect: input.onSelect,
})

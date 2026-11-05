import { Button, DropdownMenu, IconButton } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { BrainPageHeaderView } from "@/modules/types"

/** The resolved controls of the Second Brain header. */
interface BrainHeaderActionsProps {
    readonly review: BrainPageHeaderView["actions"]["review"]
    readonly add: BrainPageHeaderView["actions"]["add"]
    readonly onReview: () => void
}

/** Draws the add destination as a plain button (it never competes with a decision) and the whole-set review in the options menu. */
export const BrainHeaderActions = (props: BrainHeaderActionsProps) => (
    <>
        {props.add === null ? null : (
            <Button intent="alternative" size="sm" href={props.add.href}>
                {props.add.label}
            </Button>
        )}
        {props.review === null ? null : (
            <DropdownMenu
                placement="bottom end"
                entries={[
                    {
                        id: "review",
                        label: props.review.isRunning ? props.review.runningLabel : props.review.label,
                        onAction: props.onReview,
                    },
                ]}
                trigger={
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("more", "leading")}
                        label={props.review.menuLabel}
                        isPending={props.review.isRunning || props.review.isPending}
                    />
                }
            />
        )}
    </>
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
    panelId: (key) => `${input.tabs.panelPrefix}${key}`,
    onSelect: input.onSelect,
})

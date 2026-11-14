import { Button, Drawer, SurfaceCard } from "@starci/grammar/common"
import type { ReadinessPickView } from "@/modules/types"

/** The words of the choice. */
export interface WorkflowPickDrawerCopy {
    readonly title: string
    /** Why one account must be chosen: two accounts read the same stream, and one event starts one run. */
    readonly hint: string
    readonly choiceLabel: string
    readonly submit: string
    readonly closeLabel: string
}

/** The choice as the drawer draws it: the contested stream and its accounts (null while closed), the one checked, and the commands. */
export interface WorkflowPickDrawerView {
    readonly view: ReadinessPickView | null
    readonly selected: string | null
    readonly isSaving: boolean
    readonly select: (connectionId: string) => void
    readonly close: () => void
    readonly submit: () => void
}

/** What the drawer draws and what it does. */
interface WorkflowPickDrawerProps {
    readonly props: { readonly copy: WorkflowPickDrawerCopy; readonly pick: WorkflowPickDrawerView }
}

/**
 * The choice of the ONE source of a stream two accounts read (triggers.md rule 2): a short choice, so a drawer on the workflows page
 * like the maker of a workflow beside it. Every choice list is a `select` card with Checkbox rows; a single choice keeps the checkbox
 * look. One primary command stores the pick; the account not picked then wakes nothing for this workflow.
 */
export const WorkflowPickDrawer = (props: WorkflowPickDrawerProps) => {
    const { copy, pick } = props.props
    const view = pick.view
    return (
        <Drawer
            title={copy.title}
            description={copy.hint}
            isOpen={view !== null}
            onOpenChange={(isOpen) => {
                if (!isOpen) pick.close()
            }}
            closeLabel={copy.closeLabel}
            footer={
                <Button intent="commit" isDisabled={pick.selected === null} isPending={pick.isSaving} onPress={pick.submit}>
                    {copy.submit}
                </Button>
            }
        >
            {view === null ? null : (
                <SurfaceCard
                    kind="select"
                    selectionMode="single"
                    ariaLabel={copy.choiceLabel}
                    items={view.options.map((option) => ({ id: option.connectionId, title: option.label, subtitle: view.stream }))}
                    value={pick.selected}
                    onChange={pick.select}
                />
            )}
        </Drawer>
    )
}

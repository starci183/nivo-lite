import { Button, Cluster, Dialog, Section, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import type { ConnectionsHomeCommands, DefaultAccountView } from "./types"

/** What the default receiving account section needs. */
interface DefaultAccountSectionProps {
    readonly view: DefaultAccountView | null
    readonly on: ConnectionsHomeCommands
}

/** The one row of the section: the current account (or the notice that none is chosen) and its "Change" pill at the end. */
const rowOf = (view: DefaultAccountView, on: ConnectionsHomeCommands): ListRowData => ({
    id: view.row.id,
    title: view.row.title,
    description: view.row.description,
    ...(view.row.name === undefined
        ? {}
        : {
              leading: {
                  avatar: { name: view.row.name, ...(view.row.logo === undefined ? {} : { src: view.row.logo }), shape: "rounded" },
                  size: "md",
              },
          }),
    actionPlacement: "end",
    action: { label: view.changeLabel, intent: "neutral", press: on.openDefaultPicker },
})

/**
 * The shop's default receiving account (owner only): where every agent's payment QR goes. One row with "Change", which opens a choice
 * of the connected payment accounts that can receive (one checked); saving sends `setDefaultReceivingAccount`.
 */
export const DefaultAccountSection = (props: DefaultAccountSectionProps) => {
    const { view, on } = props
    if (view === null) return null
    const { picker } = view
    return (
        <>
            <Section kind="list" title={view.title} items={[rowOf(view, on)]} empty={null} />
            <Dialog
                isOpen={picker.isOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) on.closeDefaultPicker()
                }}
                title={picker.title}
                closeLabel={picker.closeLabel}
                footer={
                    <Cluster gap="inline" justify="end">
                        <Button intent="neutral" onPress={on.closeDefaultPicker}>
                            {picker.cancelLabel}
                        </Button>
                        <Button intent="commit" isPending={picker.isSaving} isDisabled={picker.value === null} onPress={on.saveDefault}>
                            {picker.saveLabel}
                        </Button>
                    </Cluster>
                }
            >
                <SurfaceCard
                    kind="select"
                    selectionMode="single"
                    ariaLabel={picker.title}
                    items={picker.items}
                    value={picker.value}
                    onChange={on.pickDefault}
                />
            </Dialog>
        </>
    )
}

import { Button, DescriptionList, Dialog } from "@starci/grammar/common"
import type { WorkspaceReasonView } from "@/modules/types"

/** Copy and facts the connected reason dialog supplies. */
export interface WorkspaceReasonDialogBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly byLabel: string
        readonly atLabel: string
        readonly noteLabel: string
        readonly closeLabel: string
        readonly hideLabel: string
        /** The message command with the contact's name; unused while nobody can be messaged. */
        readonly messageLabel: string
        readonly view: WorkspaceReasonView
    }
    readonly on: {
        readonly hide: () => void
        readonly message: () => void
        readonly close: () => void
    }
}

/** The details rows that have a fact: a null fact hides its row. */
const rowsOf = (props: WorkspaceReasonDialogBaseProps) => {
    const { view } = props.props
    const facts = [
        { id: "by", term: props.props.byLabel, description: view.by },
        { id: "at", term: props.props.atLabel, description: view.at },
        { id: "note", term: props.props.noteLabel, description: view.note },
    ]
    return facts.flatMap((fact) =>
        fact.description === null ? [] : [{ id: fact.id, term: fact.term, description: fact.description }],
    )
}

/** The three ways out: take the workspace off the list, message the person who turned access off, or close. */
const FooterActions = (props: WorkspaceReasonDialogBaseProps) => (
    <>
        <Button intent="dismiss" onPress={props.on.hide}>
            {props.props.hideLabel}
        </Button>
        {props.props.view.contactName === null ? null : (
            <Button intent="alternative" onPress={props.on.message}>
                {props.props.messageLabel}
            </Button>
        )}
        <Button intent="commit" onPress={props.on.close}>
            {props.props.closeLabel}
        </Button>
    </>
)

/** Draws why a member cannot open a workspace: who turned access off, when, and the note they left. */
export const WorkspaceReasonDialogBase = (props: WorkspaceReasonDialogBaseProps) => {
    const rows = rowsOf(props)
    return (
        <Dialog
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            title={props.props.title}
            description={props.props.description}
            footer={<FooterActions {...props} />}
        >
            {rows.length === 0 ? null : <DescriptionList items={rows} />}
        </Dialog>
    )
}

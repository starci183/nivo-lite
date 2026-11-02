import type { InventoryPoEditorData } from "@/modules/types"
import { Cluster, Button } from "@starci/grammar/common"

/** The words and flags of the order drawer buttons. */
interface InventoryPoActionsProps {
    readonly props: {
        readonly copy: InventoryPoEditorData["copy"]
        readonly supplierChosen: boolean
        readonly canEdit: boolean
        readonly canApprove: boolean
        readonly canReceive: boolean
        readonly canCopy: boolean
        readonly canCancel: boolean
        readonly copied: boolean
        readonly isPending: boolean
    }
    readonly on: {
        readonly sendForApproval: () => void
        readonly saveDraft: () => void
        readonly approve: () => void
        readonly reject: () => void
        readonly receive: () => void
        readonly remind: () => void
        readonly copy: () => void
        readonly cancel: () => void
    }
}

/** One button of a pair: what it says, what it means and what it does. */
type PairButton = {
    readonly label: string
    readonly intent: "commit" | "alternative"
    readonly onPress: () => void
    readonly isPending?: boolean
    readonly isDisabled?: boolean
}

/** The two buttons of one decision. */
type ActionPairProps = {
    readonly first: PairButton
    readonly second: PairButton
}

/** The button a pair item draws. */
type PairItemProps = {
    readonly button: PairButton
}

/** One button of the pair with only the flags it carries. */
const PairItem = (props: PairItemProps) => (
    <Button
        intent={props.button.intent}
        {...(props.button.isPending === undefined ? {} : { isPending: props.button.isPending })}
        {...(props.button.isDisabled === undefined ? {} : { isDisabled: props.button.isDisabled })}
        onPress={props.button.onPress}
    >
        {props.button.label}
    </Button>
)

/** The commit and its alternative of one order state. */
const ActionPair = (props: ActionPairProps) => (
    <>
        <PairItem button={props.first} />
        <PairItem button={props.second} />
    </>
)

/** The buttons of a draft order: send it for approval, or keep the draft. */
const EditActions = (props: InventoryPoActionsProps) => (
    <ActionPair
        first={{
            label: props.props.copy.poSendForApproval,
            intent: "commit",
            isPending: props.props.isPending,
            isDisabled: !props.props.supplierChosen,
            onPress: props.on.sendForApproval,
        }}
        second={{
            label: props.props.copy.poSaveDraft,
            intent: "alternative",
            isDisabled: props.props.isPending,
            onPress: props.on.saveDraft,
        }}
    />
)

/** The buttons of an order waiting for approval: approve and send it, or reject it. */
const ApproveActions = (props: InventoryPoActionsProps) => (
    <ActionPair
        first={{
            label: props.props.copy.approveAndSend,
            intent: "commit",
            isPending: props.props.isPending,
            onPress: props.on.approve,
        }}
        second={{
            label: props.props.copy.reject,
            intent: "alternative",
            isDisabled: props.props.isPending,
            onPress: props.on.reject,
        }}
    />
)

/** The buttons of a sent order: receive it, or remind the supplier. */
const ReceiveActions = (props: InventoryPoActionsProps) => (
    <ActionPair
        first={{
            label: props.props.copy.poReceive,
            intent: "commit",
            isPending: props.props.isPending,
            onPress: props.on.receive,
        }}
        second={{
            label: props.props.copy.poRemind,
            intent: "alternative",
            isDisabled: props.props.isPending,
            onPress: props.on.remind,
        }}
    />
)

/** The buttons of one purchase order: send, save, approve, receive, remind, copy and cancel, each shown only when allowed. */
export const InventoryPoActions = (props: InventoryPoActionsProps) => {
    const { props: p, on } = props
    const copy = p.copy
    return (
        <Cluster gap="inline">
            {p.canEdit ? <EditActions {...props} /> : null}
            {p.canApprove ? <ApproveActions {...props} /> : null}
            {p.canReceive ? <ReceiveActions {...props} /> : null}
            {p.canCopy ? (
                <Button intent="neutral" onPress={on.copy}>
                    {p.copied ? copy.poCopied : copy.poCopy}
                </Button>
            ) : null}
            {p.canCancel ? (
                <Button intent="destructive" step="entry" isDisabled={p.isPending} onPress={on.cancel}>
                    {copy.poCancel}
                </Button>
            ) : null}
        </Cluster>
    )
}

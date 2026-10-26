import { Button } from "@starci/grammar/common"
import type { InventorySay } from "@/modules/types"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** The words and flags of the order drawer buttons. */
interface InventoryPoActionsProps {
    readonly props: {
        readonly say: InventorySay
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
            label: props.props.say("poSendForApproval"),
            intent: "commit",
            isPending: props.props.isPending,
            isDisabled: !props.props.supplierChosen,
            onPress: props.on.sendForApproval,
        }}
        second={{
            label: props.props.say("poSaveDraft"),
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
            label: props.props.say("approveAndSend"),
            intent: "commit",
            isPending: props.props.isPending,
            onPress: props.on.approve,
        }}
        second={{
            label: props.props.say("reject"),
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
            label: props.props.say("poReceive"),
            intent: "commit",
            isPending: props.props.isPending,
            onPress: props.on.receive,
        }}
        second={{
            label: props.props.say("poRemind"),
            intent: "alternative",
            isDisabled: props.props.isPending,
            onPress: props.on.remind,
        }}
    />
)

/** The buttons of one purchase order: send, save, approve, receive, remind, copy and cancel, each shown only when allowed. */
export const InventoryPoActions = (props: InventoryPoActionsProps) => {
    const { props: p, on } = props
    const say = p.say
    return (
        <div className={ACTIONS_CLASS_NAME}>
            {p.canEdit ? <EditActions {...props} /> : null}
            {p.canApprove ? <ApproveActions {...props} /> : null}
            {p.canReceive ? <ReceiveActions {...props} /> : null}
            {p.canCopy ? (
                <Button intent="neutral" onPress={on.copy}>
                    {p.copied ? say("poCopied") : say("poCopy")}
                </Button>
            ) : null}
            {p.canCancel ? (
                <Button intent="destructive" step="entry" isDisabled={p.isPending} onPress={on.cancel}>
                    {say("poCancel")}
                </Button>
            ) : null}
        </div>
    )
}

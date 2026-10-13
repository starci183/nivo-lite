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

/** The buttons of one purchase order: send, save, approve, receive, remind, copy and cancel, each shown only when allowed. */
export const InventoryPoActions = (props: InventoryPoActionsProps) => {
    const { props: p, on } = props
    const say = p.say
    return (
        <div className={ACTIONS_CLASS_NAME}>
            {p.canEdit ? (
                <>
                    <Button
                        variant="primary"
                        isPending={p.isPending}
                        isDisabled={!p.supplierChosen}
                        onPress={on.sendForApproval}
                    >
                        {say("poSendForApproval")}
                    </Button>
                    <Button variant="secondary" isDisabled={p.isPending} onPress={on.saveDraft}>
                        {say("poSaveDraft")}
                    </Button>
                </>
            ) : null}
            {p.canApprove ? (
                <>
                    <Button variant="primary" isPending={p.isPending} onPress={on.approve}>
                        {say("approveAndSend")}
                    </Button>
                    <Button variant="outline" isDisabled={p.isPending} onPress={on.reject}>
                        {say("reject")}
                    </Button>
                </>
            ) : null}
            {p.canReceive ? (
                <>
                    <Button variant="primary" isPending={p.isPending} onPress={on.receive}>
                        {say("poReceive")}
                    </Button>
                    <Button variant="secondary" isDisabled={p.isPending} onPress={on.remind}>
                        {say("poRemind")}
                    </Button>
                </>
            ) : null}
            {p.canCopy ? (
                <Button variant="ghost" onPress={on.copy}>
                    {p.copied ? say("poCopied") : say("poCopy")}
                </Button>
            ) : null}
            {p.canCancel ? (
                <Button variant="danger-soft" isDisabled={p.isPending} onPress={on.cancel}>
                    {say("poCancel")}
                </Button>
            ) : null}
        </div>
    )
}

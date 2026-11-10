import { Alert, Button, Cluster, Stack, SurfaceCard } from "@starci/grammar/common"
import type { InboxCopy } from "@/modules/inbox"
import type { InboxApprovalView } from "@/modules/types"

/** Props for {@link InboxApprovalCard}. */
export interface InboxApprovalCardProps {
    readonly props: {
        readonly copy: InboxCopy
        readonly approval: InboxApprovalView
        /** A decision is on its way to the back end. */
        readonly isDeciding: boolean
        /** The last decision did not go through. */
        readonly failed: boolean
    }
    readonly on: {
        readonly approve: (orderId: string) => void
        readonly reject: (orderId: string) => void
        /** Opens where the order can be changed. */
        readonly edit: () => void
    }
}

/**
 * What waits for the owner on this customer: the words of the request in a banner, then the three answers through the existing decision
 * actions (approve, edit, reject). When what waits is no order there is nothing to approve here, so only the banner stands.
 */
export const InboxApprovalCard = (props: InboxApprovalCardProps) => {
    const { copy, approval, isDeciding, failed } = props.props
    const orderId = approval.orderId
    return (
        <SurfaceCard label={copy.approvalTitle} fact="1">
            <Stack gap="row">
                <Alert
                    tone="cautionary"
                    title={approval.title}
                    {...(approval.body === "" ? {} : { description: approval.body })}
                />
                {failed ? <Alert tone="negative" title={copy.approvalFailed} /> : null}
                {orderId === null ? null : (
                    <Cluster gap="inline">
                        <Button intent="commit" isPending={isDeciding} onPress={() => props.on.approve(orderId)}>
                            {copy.approve}
                        </Button>
                        <Button endArrow intent="alternative" isDisabled={isDeciding} onPress={props.on.edit}>
                            {copy.edit}
                        </Button>
                        <Button intent="neutral" isDisabled={isDeciding} onPress={() => props.on.reject(orderId)}>
                            {copy.reject}
                        </Button>
                    </Cluster>
                )}
            </Stack>
        </SurfaceCard>
    )
}

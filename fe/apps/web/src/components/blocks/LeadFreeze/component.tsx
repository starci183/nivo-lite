import { Badge, Button, Cluster, PaneSection, Sublabel, SurfaceCard, Text } from "@starci/grammar/common"

/** The words and the state of the card of a frozen customer. */
export interface LeadFreezeBaseProps {
    readonly props: {
        readonly title: string
        readonly status: string
        readonly statusTerm: string
        readonly stepTerm: string
        readonly step: string
        readonly pendingTerm: string
        readonly pending: string
        readonly heldTerm: string
        /** Who took the conversation over, or null. */
        readonly heldBy: string | null
        readonly retryLabel: string
        readonly takeOverLabel: string
        readonly skipLabel: string
        /** What each answer will do, under the card. */
        readonly caption: string
        readonly isAnswering: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly takeOver: () => void
        readonly skip: () => void
    }
}

/**
 * Draws, in a pane section of its own (the gutters of the page), a customer who waits for the owner to handle a failed run: the status chip, the failed step, what waits, and the three answers
 * (retry as the one primary, take over and skip neutral; only the answers still open are drawn, so once a person holds the customer
 * there is no take over), with what each will do as the caption under the card.
 */
export const LeadFreezeBase = (props: LeadFreezeBaseProps) => {
    const { props: view, on } = props
    const held = view.heldBy === null ? [] : [{ id: "held", term: view.heldTerm, description: view.heldBy }]
    return (
        <PaneSection gap="inline">
            <Sublabel>{view.title}</Sublabel>
            <SurfaceCard
                kind="details"
                ariaLabel={view.title}
                items={[
                    { id: "status", term: view.statusTerm, description: <Badge tone="danger">{view.status}</Badge> },
                    { id: "step", term: view.stepTerm, description: view.step },
                    { id: "pending", term: view.pendingTerm, description: view.pending },
                    ...held,
                ]}
                footers={[
                    {
                        kind: "custom" as const,
                        children: (
                            <Cluster gap="inline">
                                <Button intent="commit" isPending={view.isAnswering} onPress={on.retry}>
                                    {view.retryLabel}
                                </Button>
                                {view.heldBy === null ? (
                                    <Button intent="neutral" isDisabled={view.isAnswering} onPress={on.takeOver}>
                                        {view.takeOverLabel}
                                    </Button>
                                ) : null}
                                <Button intent="neutral" isDisabled={view.isAnswering} onPress={on.skip}>
                                    {view.skipLabel}
                                </Button>
                            </Cluster>
                        ),
                    },
                ]}
            />
            <Text size="sm" tone="muted">
                {view.caption}
            </Text>
        </PaneSection>
    )
}

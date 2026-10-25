import { Alert, Badge, Button, EmptyNotice, Heading, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import { ACTIONS_CLASS_NAME, HEAD_CLASS_NAME } from "./classNames"

/** One offer, every word already resolved. */
interface OfferRowView {
    readonly id: string
    readonly candidateId: string
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly meta: string
    readonly sent: string | null
    readonly isWaiting: boolean
    readonly copyLabel: string | null
    readonly canCancel: boolean
}

/** What the connected block settled for the offers tab. */
export interface HiringOffersBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly approveLabel: string | null
        readonly decisionsHref: string
        readonly fact: string
        readonly rows: ReadonlyArray<OfferRowView>
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly open: (candidateId: string) => void
        readonly copy: (id: string) => void
        readonly cancel: (id: string) => void
        readonly clearError: () => void
    }
}

/** Draws the offers tab: every offer and where it stands. A letter waiting for the owner is approved in Decisions. */
export const HiringOffersBase = (props: HiringOffersBaseProps) => {
    const { say, approveLabel, decisionsHref, fact, rows, isBusy, error } = props.props
    const { on } = props
    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <Heading level={2}>{say("offersTitle")}</Heading>
                {approveLabel === null ? null : (
                    <Button intent="commit" href={decisionsHref}>
                        {approveLabel}
                    </Button>
                )}
            </div>
            {error === null ? null : (
                <Alert
                    tone="negative"
                    title={say("errorTitle")}
                    description={error}
                    dismissLabel={say("dismiss")}
                    onDismiss={on.clearError}
                />
            )}
            <SurfaceListCard
                label={say("offersList")}
                fact={fact}
                empty={<EmptyNotice message={say("offersEmptyTitle")} description={say("offersEmptyBody")} />}
            >
                {rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.name}
                        badges={
                            <Badge tone={row.statusTone} isDot>
                                {row.statusLabel}
                            </Badge>
                        }
                        description={row.meta}
                        actions={
                            <div className={ACTIONS_CLASS_NAME}>
                                <Button intent="dismiss" size="sm" onPress={() => on.open(row.candidateId)}>
                                    {say("pipeOpen")}
                                </Button>
                                {row.isWaiting ? (
                                    <Button intent="alternative" size="sm" href={decisionsHref}>
                                        {say("offersApprove")}
                                    </Button>
                                ) : null}
                                {row.copyLabel === null ? null : (
                                    <Button intent="alternative" size="sm" onPress={() => on.copy(row.id)}>
                                        {row.copyLabel}
                                    </Button>
                                )}
                                {row.canCancel ? (
                                    <Button
                                        intent="destructive"
                                        step="entry"
                                        size="sm"
                                        isDisabled={isBusy}
                                        onPress={() => on.cancel(row.id)}
                                    >
                                        {say("candCancelOffer")}
                                    </Button>
                                ) : null}
                            </div>
                        }
                    >
                        {row.sent === null ? null : (
                            <Text size="xs" tone="muted">
                                {row.sent}
                            </Text>
                        )}
                    </ListRow>
                ))}
            </SurfaceListCard>
        </>
    )
}

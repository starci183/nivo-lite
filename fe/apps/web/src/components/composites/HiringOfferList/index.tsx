import type { HiringViews, HiringActions } from "@/modules/types"

type HiringOfferListProps = HiringViews["offersFields"] & {
    readonly on: HiringActions["offersActions"]
    readonly isLoading: boolean
}
import {
    Alert,
    Button,
    EmptyNotice,
    SurfaceCard,
    Text,
    type DropdownMenuItem,
    type ListRowData,
} from "@starci/grammar/common"

/** Draws the offers tab: every offer and where it stands. A letter waiting for the owner is approved in Decisions. */
export const HiringOfferList = (props: HiringOfferListProps) => {
    const { copy, approveLabel, decisionsHref, fact, rows, isBusy, error } = props
    const { on } = props
    return (
        <>
            {error === null ? null : (
                <Alert
                    tone="negative"
                    title={copy.errorTitle}
                    description={error}
                    dismissLabel={copy.dismiss}
                    onDismiss={on.clearError}
                />
            )}
            <SurfaceCard
                isLoading={props.isLoading}
                kind="list"
                label={copy.offersList}
                headingLevel={2}
                fact={fact}
                {...(approveLabel === null
                    ? {}
                    : {
                          labelEnd: (
                              <Button endArrow isLoading={props.isLoading} intent="commit" href={decisionsHref}>
                                  {approveLabel}
                              </Button>
                          ),
                      })}
                empty={<EmptyNotice message={copy.offersEmptyTitle} description={copy.offersEmptyBody} />}
                items={rows.map((row): ListRowData => {
                    const further: Array<DropdownMenuItem> = []
                    if (row.isWaiting) {
                        further.push({ id: "approve", label: copy.offersApprove, href: decisionsHref })
                    }
                    if (row.copyLabel !== null) {
                        further.push({ id: "copy", label: row.copyLabel, onAction: () => on.copy(row.id) })
                    }
                    if (row.canCancel) {
                        further.push({
                            id: "cancel",
                            label: copy.candCancelOffer,
                            tone: "danger",
                            isDisabled: isBusy,
                            onAction: () => on.cancel(row.id),
                        })
                    }
                    return {
                        id: row.id,
                        title: row.name,
                        badges: [{ label: row.statusLabel, tone: row.statusTone, isDot: true }],
                        description: row.meta,
                        action: { label: copy.pipeOpen, intent: "dismiss", press: () => on.open(row.candidateId) },
                        ...(further.length === 0 ? {} : { menu: { label: row.name, entries: further } }),
                        detail:
                            row.sent === null ? undefined : (
                                <Text isLoading={props.isLoading} size="xs" tone="muted">
                                    {row.sent}
                                </Text>
                            ),
                    }
                })}
            />
        </>
    )
}

import type { ReactNode } from "react"
import type { LoyaltyViews } from "../types"
import { Badge, EmptyNotice, SurfaceCard, Text, Timeline, Cluster } from "@starci/grammar/common"

/** What the points history draws. */
type MemberLedgerData = LoyaltyViews["memberLedger"]
/** The existing native presentation contract, with pure fields and actions owned separately. */
interface LoyaltyLedgerProps extends MemberLedgerData {
    readonly isLoading: boolean
}

/** The points history of a member as a timeline: what moved, how much, when and by whom. */
export const LoyaltyLedger = (props: LoyaltyLedgerProps): ReactNode => (
    <SurfaceCard label={props.title} headingLevel={3} isLoading={props.isLoading}>
        {props.rows.length === 0 ? (
            <EmptyNotice message={props.emptyText} />
        ) : (
            <Timeline
                label={props.title}
                items={props.rows.map((row) => ({
                    id: row.id,
                    title: (
                        <Cluster gap="inline">
                            <Badge tone={row.tone}>{row.kind}</Badge>
                            <Text as="span" isStrong>
                                {row.points}
                            </Text>
                            {row.amount === undefined ? null : (
                                <Text as="span" size="sm" tone="muted">
                                    {row.amount}
                                </Text>
                            )}
                        </Cluster>
                    ),
                    dateTime: row.dateTime,
                    timeLabel: row.timeLabel,
                    ...(row.ref === undefined && row.evidence === undefined
                        ? {}
                        : {
                              description: (
                                  <>
                                      {row.ref === undefined ? null : (
                                          <Text as="span" size="sm">
                                              {row.ref}
                                          </Text>
                                      )}
                                      {row.evidence === undefined ? null : (
                                          <Text as="span" size="xs" tone="muted">
                                              {row.evidence}
                                          </Text>
                                      )}
                                  </>
                              ),
                          }),
                }))}
            />
        )}
    </SurfaceCard>
)

import { Badge, EmptyNotice, SurfaceCard, Text, Timeline } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { CHIPS_CLASS_NAME } from "./classNames"

/** What the points history draws. */
export interface LoyaltyLedgerProps {
    readonly title: string
    readonly emptyText: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly kind: string
        readonly tone: BadgeTone
        readonly points: string
        readonly amount?: string
        readonly dateTime: string
        readonly timeLabel: string
        readonly ref?: string
        readonly evidence?: string
    }>
}

/** The points history of a member as a timeline: what moved, how much, when and by whom. */
export const LoyaltyLedger = (props: LoyaltyLedgerProps) => (
    <SurfaceCard label={props.title} headingLevel={3}>
        {props.rows.length === 0 ? (
            <EmptyNotice message={props.emptyText} />
        ) : (
            <Timeline
                label={props.title}
                items={props.rows.map((row) => ({
                    id: row.id,
                    title: (
                        <div className={CHIPS_CLASS_NAME}>
                            <Badge tone={row.tone}>{row.kind}</Badge>
                            <Text as="span" weight="semibold">
                                {row.points}
                            </Text>
                            {row.amount === undefined ? null : (
                                <Text as="span" size="sm" tone="muted">
                                    {row.amount}
                                </Text>
                            )}
                        </div>
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

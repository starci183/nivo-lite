import { LoyaltyCampaignMessage } from "@/components/composites/LoyaltyCampaignMessage"
import { LoyaltyCampaignSegment } from "@/components/composites/LoyaltyCampaignSegment"
import { Alert, Badge, EmptyNotice, ListRow, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { BODY_CLASS_NAME } from "./classNames"

/** What a quoted draft shows: its label and its text. */
interface DraftQuoteProps {
    readonly label: string
    readonly draft: string
}

/** A drafted message quoted inside its row or result: a nested Grammar surface with its label and text. */
const DraftQuote = (props: DraftQuoteProps) => (
    <SurfaceCard>
        <div className={BODY_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="medium">
                {props.label}
            </Text>
            <Text as="p" size="sm">
                {props.draft}
            </Text>
        </div>
    </SurfaceCard>
)

/** One line of the live count under the segment. */
export interface LoyaltyPromoPreviewLine {
    readonly id: string
    readonly text: string
    readonly emphasis: boolean
}

/** The message the back end wrote for the offer just sent in. */
export interface LoyaltyPromoResult {
    readonly title: string
    readonly recipients: string
    readonly time: string
    readonly draft: string
}

/** One offer already prepared. */
export interface LoyaltyPromoRow {
    readonly id: string
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly counts: string
    readonly meta: string
    readonly draft: string
}

/** Props for {@link LoyaltyPromoBase}. */
export interface LoyaltyPromoBaseProps {
    readonly props: {
        readonly canManage: boolean
        readonly copy: {
            readonly title: string
            readonly body: string
            readonly tiers: string
            readonly tiersHint: string
            readonly inactive: string
            readonly inactiveHint: string
            readonly spend: string
            readonly spendHint: string
            readonly birthday: string
            readonly name: string
            readonly nameHint: string
            readonly brief: string
            readonly briefHint: string
            readonly submit: string
            readonly drafting: string
            readonly failedTitle: string
            readonly draftLabel: string
            readonly managersOnly: string
            readonly managersOnlyBody: string
            readonly campaignsTitle: string
            readonly campaignsEmptyTitle: string
            readonly campaignsEmptyBody: string
        }
        readonly tierOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly values: {
            readonly tiers: ReadonlyArray<string>
            readonly inactive: string
            readonly spend: string
            readonly birthday: boolean
            readonly name: string
            readonly brief: string
        }
        readonly briefError?: string | undefined
        readonly previewLines: ReadonlyArray<LoyaltyPromoPreviewLine>
        readonly briefMax: number
        readonly isBusy: boolean
        readonly isDrafting: boolean
        readonly isSubmitDisabled: boolean
        readonly result?: LoyaltyPromoResult
        readonly failure?: string
        readonly rows: ReadonlyArray<LoyaltyPromoRow>
    }
    readonly on: {
        readonly setTiers: (value: ReadonlyArray<string>) => void
        readonly setInactive: (value: string) => void
        readonly setSpend: (value: string) => void
        readonly setBirthday: (value: boolean) => void
        readonly setName: (value: string) => void
        readonly setBrief: (value: string) => void
        readonly submit: () => void
    }
}

/** Draws the promotion builder (segment, live count, offer text, the drafted message) and the list of offers already prepared; staff see a notice instead of the builder. */
export const LoyaltyPromoBase = (props: LoyaltyPromoBaseProps) => {
    const { canManage, copy } = props.props
    return (
        <>
            {canManage ? (
                renderPromotionBuilder(props)
            ) : (
                <SurfaceCard ariaLabel={copy.title}>
                    <EmptyNotice message={copy.managersOnly} description={copy.managersOnlyBody} />
                </SurfaceCard>
            )}

            <SurfaceListCard
                label={copy.campaignsTitle}
                headingLevel={2}
                empty={<EmptyNotice message={copy.campaignsEmptyTitle} description={copy.campaignsEmptyBody} />}
            >
                {props.props.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.name}
                        description={`${row.counts} · ${row.meta}`}
                        badges={<Badge tone={row.statusTone}>{row.statusLabel}</Badge>}
                    >
                        {row.draft === "" ? null : <DraftQuote label={copy.draftLabel} draft={row.draft} />}
                    </ListRow>
                ))}
            </SurfaceListCard>
        </>
    )
}

/** Draws the title section of the current view. */
const renderPromotionBuilder = (props: LoyaltyPromoBaseProps) => {
    const { copy, result, failure } = props.props
    return (
        <SurfaceCard label={copy.title} headingLevel={2}>
            <div className={BODY_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {copy.body}
                </Text>
                <LoyaltyCampaignSegment {...props} />

                <SurfaceCard>
                    <div className={BODY_CLASS_NAME} aria-live="polite">
                        {props.props.previewLines.map((line) => (
                            <Text
                                key={line.id}
                                size={line.emphasis ? "md" : "xs"}
                                weight={line.emphasis ? "semibold" : "normal"}
                                tone={line.emphasis ? "default" : "muted"}
                            >
                                {line.text}
                            </Text>
                        ))}
                    </div>
                </SurfaceCard>

                <LoyaltyCampaignMessage {...props} />

                <div aria-live="polite">
                    {failure === undefined ? null : (
                        <Alert title={copy.failedTitle} description={failure} tone="negative" />
                    )}
                    {result === undefined ? null : (
                        <SurfaceCard>
                            <div className={BODY_CLASS_NAME}>
                                <Text weight="semibold">{result.title}</Text>
                                <Text size="sm">{result.recipients}</Text>
                                {result.time === "" ? null : (
                                    <Text size="xs" tone="muted">
                                        {result.time}
                                    </Text>
                                )}
                                <DraftQuote label={copy.draftLabel} draft={result.draft} />
                            </div>
                        </SurfaceCard>
                    )}
                </div>
            </div>
        </SurfaceCard>
    )
}

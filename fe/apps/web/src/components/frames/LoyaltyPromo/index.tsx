import type { LoyaltyViews } from "@/modules/types"
import type { ReactNode } from "react"

import { EmptyNotice, Quote, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** What a quoted draft shows: its label and its text. */
interface DraftQuoteProps {
    readonly label: string
    readonly draft: string
}

/** A drafted message quoted within its host without nesting surfaces. */
const DraftQuote = (props: DraftQuoteProps) => <Quote source={props.label} text={props.draft} />

/** One offer already prepared. */

/** What the promotion tab draws once the board read is in. */
type LoyaltyPromoView = LoyaltyViews["promotion"]

/** Draws the promotion builder (segment, live count, offer text, the drafted message) and the list of offers already prepared; staff see a notice instead of the builder. */
export const LoyaltyPromo = (props: LoyaltyPromoProps) => {
    const { canManage, copy } = props
    return (
        <>
            {canManage ? (
                renderPromotionBuilder(props)
            ) : (
                <SurfaceCard ariaLabel={copy.title}>
                    <EmptyNotice message={copy.managersOnly} description={copy.managersOnlyBody} />
                </SurfaceCard>
            )}

            <SurfaceCard
                kind="list"
                isLoading={props.isLoading}
                label={copy.campaignsTitle}
                headingLevel={2}
                empty={<EmptyNotice message={copy.campaignsEmptyTitle} description={copy.campaignsEmptyBody} />}
                items={props.rows.map((row) => ({
                    id: row.id,
                    title: row.name,
                    description: `${row.counts} · ${row.meta}`,
                    badges: [{ label: row.statusLabel, tone: row.statusTone }],
                    detail: row.draft === "" ? null : <DraftQuote label={copy.draftLabel} draft={row.draft} />,
                }))}
            />
        </>
    )
}
/** The existing builder/history frame leaves each real read and its controls with the owning Base. */
const renderPromotionBuilder = (props: LoyaltyPromoProps) => (
    <SurfaceCard label={props.copy.title} headingLevel={2} isLoading={props.isLoading}>
        <Stack gap="row">
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.copy.body}
            </Text>
            {props.children}
        </Stack>
    </SurfaceCard>
)

interface LoyaltyPromoProps extends Pick<LoyaltyPromoView, "canManage" | "copy" | "rows"> {
    readonly isLoading: boolean
    readonly children: ReactNode
}

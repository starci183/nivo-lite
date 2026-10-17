import { Alert, Badge, Button, DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { LoyaltyLedger } from "@/components/branches/LoyaltyLedger"
import type { LoyaltyLedgerProps } from "@/components/branches/LoyaltyLedger"
import { LoyaltyMemberAdjustForm } from "@/components/branches/LoyaltyMemberAdjustForm"
import type { LoyaltyMemberAdjustFormProps } from "@/components/branches/LoyaltyMemberAdjustForm"
import { LoyaltyMemberEditForm } from "@/components/branches/LoyaltyMemberEditForm"
import type { LoyaltyMemberEditFormProps } from "@/components/branches/LoyaltyMemberEditForm"
import { LoyaltyRewardOptions } from "@/components/branches/LoyaltyRewardOptions"
import type { LoyaltyRewardOptionsProps } from "@/components/branches/LoyaltyRewardOptions"
import { BODY_CLASS_NAME, CHIPS_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** One member as the panel draws it. */
interface LoyaltyMemberPanelView {
    readonly name: string
    readonly closeLabel: string
    readonly tier?: { readonly name: string; readonly tone: BadgeTone }
    readonly points: string
    readonly contact: string
    readonly spentLine: string
    readonly joinedLine: string
    readonly nextTierLine: string
    readonly expiringLine?: string
    readonly editTitle: string
    readonly edit?: LoyaltyMemberEditFormProps
    readonly readOnly?: {
        readonly items: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
        readonly note: string
    }
    readonly adjustTitle: string
    readonly adjustBody: string
    readonly adjust: LoyaltyMemberAdjustFormProps
    readonly rewards: LoyaltyRewardOptionsProps
    readonly ledger: LoyaltyLedgerProps
    readonly asOf: string
}

/** What the member panel draws: a loading line, a failure, or the member. */
export interface LoyaltyMemberPanelProps {
    readonly loading?: { readonly text: string }
    readonly failed?: { readonly title: string; readonly text: string }
    readonly view?: LoyaltyMemberPanelView
    readonly onClose: () => void
}

/** One member: header, details, point adjustment, rewards they can redeem now and the points history. */
export const LoyaltyMemberPanel = (props: LoyaltyMemberPanelProps) => {
    const { loading, failed, view } = props
    if (failed !== undefined) {
        return (
            <SurfaceCard ariaLabel={failed.title}>
                <Alert title={failed.title} description={failed.text} tone="negative" />
            </SurfaceCard>
        )
    }
    if (view === undefined) {
        const text = loading === undefined ? "" : loading.text
        return (
            <SurfaceCard ariaLabel={text}>
                <Text size="sm" tone="muted" live="polite">
                    {text}
                </Text>
            </SurfaceCard>
        )
    }
    return renderLoyaltyMemberPanelMember(view, props)
}

/** Renders the LoyaltyMemberPanel member section. */
const renderLoyaltyMemberPanelMember = (
    view: NonNullable<LoyaltyMemberPanelProps["view"]>,
    props: LoyaltyMemberPanelProps,
) => (
    <div className={STACK_CLASS_NAME}>
        <SurfaceCard
            label={view.name}
            headingLevel={2}
            labelEnd={
                <Button variant="ghost" size="sm" onPress={props.onClose}>
                    {view.closeLabel}
                </Button>
            }
        >
            <div className={BODY_CLASS_NAME}>
                <div className={CHIPS_CLASS_NAME}>
                    {view.tier === undefined ? null : <Badge tone={view.tier.tone}>{view.tier.name}</Badge>}
                    <Text as="span" size="md" weight="semibold">
                        {view.points}
                    </Text>
                </div>
                <Text size="sm" tone="muted">
                    {view.contact}
                </Text>
                <Text size="sm">{view.spentLine}</Text>
                <Text size="sm" tone="muted">
                    {view.joinedLine}
                </Text>
                <Text size="sm">{view.nextTierLine}</Text>
                {view.expiringLine === undefined ? null : (
                    <Text size="sm" weight="medium">
                        {view.expiringLine}
                    </Text>
                )}
            </div>
        </SurfaceCard>
        <SurfaceCard label={view.editTitle} headingLevel={3}>
            <div className={BODY_CLASS_NAME}>
                {view.edit === undefined ? null : <LoyaltyMemberEditForm {...view.edit} />}
                {view.readOnly === undefined ? null : (
                    <>
                        <DescriptionList layout="columns" items={[...view.readOnly.items]} />
                        <Text size="xs" tone="muted">
                            {view.readOnly.note}
                        </Text>
                    </>
                )}
            </div>
        </SurfaceCard>
        <SurfaceCard label={view.adjustTitle} headingLevel={3}>
            <div className={BODY_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {view.adjustBody}
                </Text>
                <LoyaltyMemberAdjustForm {...view.adjust} />
            </div>
        </SurfaceCard>
        <LoyaltyRewardOptions {...view.rewards} />
        <LoyaltyLedger {...view.ledger} />
        <Text size="xs" tone="muted">
            {view.asOf}
        </Text>
    </div>
)

import type { ReactNode } from "react"
import { Button, Disclosure, Skeleton, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import { CreditsListRow } from "@/components/branches/CreditsListRow"
import type { CreditsOverviewView } from "@/hooks/credits"
import type { PayTarget } from "@/modules/types"
import { COPY_CLASS_NAME, STACK_CLASS_NAME, COLUMN_CLASS_NAME } from "./classNames"

interface CreditsUpgradeProps {
    readonly props: {
        readonly view: CreditsOverviewView
        readonly title: string
        readonly plansLabel: string
        readonly plansTitle: string
        readonly plansCta: string
        readonly plansHref: string
        readonly loading: string
        readonly isSkeleton: boolean
    }
    readonly on: { readonly upgrade: (target: PayTarget) => void }
}

/** Draws a recommended upgrade, the contact offer and the plan comparison. */
export const CreditsUpgrade = (props: CreditsUpgradeProps) => {
    const copy = props.props
    const { upgrade, contact } = copy.view
    let offer: ReactNode = null
    if (copy.isSkeleton)
        offer = (
            <SurfaceCard label={copy.title} headingLevel={2}>
                <div className={STACK_CLASS_NAME}>
                    <Text size="metric-lead" isSkeleton>
                        {copy.loading}
                    </Text>
                    <Skeleton shape="text" lines={2} />
                </div>
            </SurfaceCard>
        )
    else if (upgrade) offer = renderCreditsUpgradeRecommendation(copy, upgrade, props)
    else if (contact)
        offer = (
            <SurfaceCard label={copy.title} headingLevel={2}>
                <div className={STACK_CLASS_NAME}>
                    <div className={COPY_CLASS_NAME}>
                        <Text size="metric-lead" weight="semibold">
                            {contact.name}
                        </Text>
                        <Text size="sm" tone="muted">
                            {contact.text}
                        </Text>
                    </div>
                    {copy.view.canBuy ? (
                        <div>
                            <Button intent="neutral" href={contact.href} target="_blank" rel="noopener noreferrer">
                                {contact.action}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </SurfaceCard>
        )
    const plans = copy.isSkeleton
        ? Array.from({ length: 3 }, (_, index) => ({
              id: String(index),
              title: copy.loading,
              description: copy.loading,
              badge: "",
          }))
        : copy.view.plans
    const rows = plans.map((plan) => ({
        id: plan.id,
        props: {
            title: plan.title,
            description: plan.description,
            badge: plan.badge,
            badgeTone: "neutral" as const,
            isSkeleton: copy.isSkeleton,
        },
    }))
    return (
        <div className={COLUMN_CLASS_NAME}>
            {offer}
            <Disclosure title={copy.plansTitle} headingLevel={3}>
                <SurfaceListCard ariaLabel={copy.plansLabel} isLoading={copy.isSkeleton}>
                    {rows.map((row) => (
                        <CreditsListRow key={row.id} props={row.props} />
                    ))}
                </SurfaceListCard>
                {copy.view.canBuy && !copy.isSkeleton ? (
                    <Button intent="neutral" size="sm" href={copy.plansHref}>
                        {copy.plansCta}
                    </Button>
                ) : null}
            </Disclosure>
        </div>
    )
}

/** Renders the CreditsUpgrade recommendation section. */
const renderCreditsUpgradeRecommendation = (
    copy: NonNullable<CreditsUpgradeProps["props"]>,
    upgrade: NonNullable<CreditsUpgradeProps["props"]["view"]["upgrade"]>,
    props: CreditsUpgradeProps,
) => (
    <SurfaceCard label={copy.title} headingLevel={2} isHighlight>
        <div className={STACK_CLASS_NAME}>
            <div className={COPY_CLASS_NAME}>
                <Text size="metric-lead" weight="semibold">
                    {upgrade.name}
                </Text>
                <Text size="sm" tone="muted">
                    {upgrade.line}
                </Text>
                <Text weight="semibold">{upgrade.price}</Text>
            </div>
            {copy.view.canBuy ? (
                <div>
                    <Button
                        intent="commit"
                        isPending={upgrade.pending}
                        isDisabled={upgrade.disabled}
                        onPress={() => props.on.upgrade(upgrade.target)}
                    >
                        {upgrade.action}
                    </Button>
                </div>
            ) : null}
        </div>
    </SurfaceCard>
)

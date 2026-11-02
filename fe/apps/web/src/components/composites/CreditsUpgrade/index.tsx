import type { ReactNode } from "react"
import { Button, Disclosure, EmptyNotice, Stack, SurfaceCard, type ListRowData } from "@starci/grammar/common"

import type { CreditsOverviewView, PayTarget } from "@/modules/types"

interface CreditsUpgradeProps {
    readonly props: {
        readonly view: CreditsOverviewView
        readonly title: string
        readonly plansLabel: string
        readonly plansTitle: string
        readonly plansCta: string
        readonly plansHref: string
        readonly loading: string
        readonly isLoading: boolean
    }
    readonly on: { readonly upgrade: (target: PayTarget) => void }
}

/** Draws a recommended upgrade, the contact offer and the plan comparison. */
export const CreditsUpgrade = (props: CreditsUpgradeProps) => {
    const copy = props.props
    const { upgrade, contact } = copy.view
    let offer: ReactNode = null
    if (upgrade) offer = renderCreditsUpgradeRecommendation(copy, upgrade, props)
    else if (contact)
        offer = (
            <SurfaceCard
                kind="list"
                label={copy.title}
                headingLevel={2}
                isLoading={copy.isLoading}
                empty={<EmptyNotice message={copy.title} />}
                items={[
                    {
                        id: "contact",
                        title: contact.name,
                        description: contact.text,
                        detail: copy.view.canBuy ? (
                            <Button intent="neutral" href={contact.href} target="_blank" rel="noopener noreferrer">
                                {contact.action}
                            </Button>
                        ) : undefined,
                    },
                ]}
            />
        )
    const items: ReadonlyArray<ListRowData> = copy.view.plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        description: plan.description,
        ...(plan.badge ? { badges: [{ label: plan.badge, tone: "neutral" }] } : {}),
    }))
    return (
        <Stack gap="section">
            {offer}
            <Disclosure
                title={copy.plansTitle}
                headingLevel={3}
                body={
                    <>
                        <SurfaceCard
                            kind="list"
                            ariaLabel={copy.plansLabel}
                            isLoading={copy.isLoading}
                            items={items}
                            empty={<EmptyNotice message={copy.plansTitle} />}
                        />
                        {copy.view.canBuy ? (
                            <Button intent="neutral" size="sm" href={copy.plansHref} isLoading={copy.isLoading}>
                                {copy.plansCta}
                            </Button>
                        ) : null}
                    </>
                }
            />
        </Stack>
    )
}

/** Renders the CreditsUpgrade recommendation section. */
const renderCreditsUpgradeRecommendation = (
    copy: NonNullable<CreditsUpgradeProps["props"]>,
    upgrade: NonNullable<CreditsUpgradeProps["props"]["view"]["upgrade"]>,
    props: CreditsUpgradeProps,
) => (
    <SurfaceCard
        kind="figures"
        label={copy.title}
        headingLevel={2}
        isHighlight
        isLoading={copy.isLoading}
        items={[{ id: upgrade.name, term: upgrade.name, value: upgrade.price, meta: upgrade.line }]}
        labelEnd={
            copy.view.canBuy ? (
                <Button
                    intent="commit"
                    isPending={upgrade.pending}
                    isDisabled={upgrade.disabled}
                    isLoading={copy.isLoading}
                    onPress={() => props.on.upgrade(upgrade.target)}
                >
                    {upgrade.action}
                </Button>
            ) : undefined
        }
    />
)

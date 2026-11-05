import type { ReactNode } from "react"
import { Button, EmptyNotice, Stack, SurfaceCard } from "@starci/grammar/common"

import type { CreditsOverviewView, PayTarget } from "@/modules/types"

interface CreditsUpgradeProps {
    readonly props: {
        readonly view: CreditsOverviewView
        readonly title: string
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
    return <Stack gap="section">{offer}</Stack>
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

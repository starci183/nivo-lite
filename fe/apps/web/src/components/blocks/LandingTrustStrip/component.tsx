import { List, ListItem, PageContainer, Region, SurfaceCard, Text } from "@starci/grammar/common"
import { Icon, type IconName } from "@/components/leaves/Icon"
import { SECTION_STACK, TRUST_LIST, TRUST_ROW, TRUST_WHO } from "./classNames"

/** One situation the product watches. */
interface LandingTrustChip {
    readonly id: string
    readonly label: string
    readonly icon: IconName
}

/** The resolved words the trust strip draws. */
interface LandingTrustStripBaseProps {
    readonly props: {
        readonly lead: string
        readonly forLabel: string
        readonly audience: string
        readonly sub: string
        readonly chips: ReadonlyArray<LandingTrustChip>
    }
}

/** Who the product is for plus the situations it watches, on one top-level card. */
export const LandingTrustStripBase = (props: LandingTrustStripBaseProps) => {
    const chips = props.props.chips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        iconProps: { name: chip.icon, usage: "leading" } as const,
    }))
    return (
        <Region label={props.props.forLabel}>
            <PageContainer measure="product">
                <div className={SECTION_STACK}>
                    <Text tone="muted">{props.props.lead}</Text>
                    <SurfaceCard>
                        <div className={TRUST_ROW}>
                            <div className={TRUST_WHO}>
                                <Text size="xs">{props.props.forLabel}</Text>
                                <Text size="md" weight="semibold">
                                    {props.props.audience}
                                </Text>
                                <Text size="sm" tone="muted">
                                    {props.props.sub}
                                </Text>
                            </div>
                            <List label={props.props.forLabel} className={TRUST_LIST}>
                                {chips.map((chip) => (
                                    <ListItem key={chip.id}>
                                        <Text size="sm" startContent={<Icon props={chip.iconProps} />}>
                                            {chip.label}
                                        </Text>
                                    </ListItem>
                                ))}
                            </List>
                        </div>
                    </SurfaceCard>
                </div>
            </PageContainer>
        </Region>
    )
}

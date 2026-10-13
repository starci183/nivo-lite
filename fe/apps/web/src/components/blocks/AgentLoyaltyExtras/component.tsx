import { SurfaceCard, Text, TextAction } from "@starci/grammar/common"

/** Copy and address of the loyalty program card. */
export interface AgentLoyaltyExtrasBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly openLabel: string
        readonly openHref: string
    }
}

/** Draws the card that points a loyalty agent's settings to the program on its workbench. */
export const AgentLoyaltyExtrasBase = (props: AgentLoyaltyExtrasBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <Text size="sm" tone="muted">
            {props.props.description}
        </Text>
        <TextAction href={props.props.openHref} size="sm">
            {props.props.openLabel}
        </TextAction>
    </SurfaceCard>
)

import {
    Badge,
    Cluster,
    Grid,
    Heading,
    PageContainer,
    Region,
    SectionHeader,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { IconGlyph } from "@/components/leaves/Icon"
import type { IconGlyphName } from "@/components/leaves/Icon"
import { ANCHOR } from "./classNames"

/** One step of the flow: who acts, what happens, and whether the person decides. */
interface LandingFlowStep {
    readonly id: string
    readonly stepLabel: string
    readonly icon: IconGlyphName
    readonly agentName: string
    readonly title: string
    readonly text: string
    readonly hasAiMark: boolean
    readonly isHumanStep: boolean
}

/** The resolved words the flow section draws. */
interface LandingFlowBaseProps {
    readonly props: {
        readonly headingId: string
        readonly eyebrow: string
        readonly title: string
        readonly lead: string
        readonly aiMark: string
        readonly humanTag: string
        readonly steps: ReadonlyArray<LandingFlowStep>
    }
}

/** Chatbot, Sales Agent, owner approval, Accounting Agent, as an ordered list of cards. */
export const LandingFlowBase = (props: LandingFlowBaseProps) => (
    <Region id="how" labelledBy={props.props.headingId} className={ANCHOR}>
        <PageContainer measure="product">
            <Stack gap="section">
                <SectionHeader
                    id={props.props.headingId}
                    eyebrow={props.props.eyebrow}
                    title={props.props.title}
                    description={props.props.lead}
                />
                <Grid kind="cards" columns={4}>
                    {props.props.steps.map((step) => (
                        <SurfaceCard key={step.id} height="fill" isHighlight={step.isHumanStep}>
                            <Stack gap="row">
                                <Cluster gap="inline" justify="between">
                                    <Text size="xs">{step.stepLabel}</Text>
                                    {step.isHumanStep ? <Badge tone="neutral">{props.props.humanTag}</Badge> : null}
                                </Cluster>
                                <IconGlyph name={step.icon} isTile />
                                <Cluster gap="inline">
                                    <Text size="sm" weight="medium">
                                        {step.agentName}
                                    </Text>
                                    {step.hasAiMark ? <Badge tone="neutral">{props.props.aiMark}</Badge> : null}
                                </Cluster>
                                <Heading level={3}>{step.title}</Heading>
                                <Text size="sm" tone="muted">
                                    {step.text}
                                </Text>
                            </Stack>
                        </SurfaceCard>
                    ))}
                </Grid>
            </Stack>
        </PageContainer>
    </Region>
)

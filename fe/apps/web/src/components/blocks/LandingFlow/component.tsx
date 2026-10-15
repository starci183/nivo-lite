import {
    Badge,
    Heading,
    List,
    ListItem,
    PageContainer,
    Region,
    SectionHeader,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { LandingIconTile, type IconName } from "@/components/leaves/Icon"
import { ANCHOR, FLOW_BODY, FLOW_GRID, FLOW_ITEM, FLOW_META, FLOW_NAME, SECTION_STACK } from "./classNames"

/** One step of the flow: who acts, what happens, and whether the person decides. */
interface LandingFlowStep {
    readonly id: string
    readonly stepLabel: string
    readonly icon: IconName
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
            <div className={SECTION_STACK}>
                <SectionHeader
                    id={props.props.headingId}
                    eyebrow={props.props.eyebrow}
                    title={props.props.title}
                    description={props.props.lead}
                />
                <List as="ol" label={props.props.title} className={FLOW_GRID}>
                    {props.props.steps.map((step) => (
                        <ListItem key={step.id} className={FLOW_ITEM}>
                            <SurfaceCard height="fill" isHighlight={step.isHumanStep}>
                                <div className={FLOW_BODY}>
                                    <div className={FLOW_META}>
                                        <Text size="xs">{step.stepLabel}</Text>
                                        {step.isHumanStep ? <Badge tone="neutral">{props.props.humanTag}</Badge> : null}
                                    </div>
                                    <LandingIconTile name={step.icon} />
                                    <div className={FLOW_NAME}>
                                        <Text size="sm" weight="medium">
                                            {step.agentName}
                                        </Text>
                                        {step.hasAiMark ? <Badge tone="neutral">{props.props.aiMark}</Badge> : null}
                                    </div>
                                    <Heading level={3}>{step.title}</Heading>
                                    <Text size="sm" tone="muted">
                                        {step.text}
                                    </Text>
                                </div>
                            </SurfaceCard>
                        </ListItem>
                    ))}
                </List>
            </div>
        </PageContainer>
    </Region>
)

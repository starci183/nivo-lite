import { Badge, Cluster, EmptyNotice, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
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
        readonly emptyLabel: string
        readonly aiMark: string
        readonly humanTag: string
        readonly steps: ReadonlyArray<LandingFlowStep>
    }
}

/** Chatbot, Sales Agent, owner approval, Accounting Agent, as an ordered list of cards. */
export const LandingFlowBase = (props: LandingFlowBaseProps) => (
    <div id="how" className={ANCHOR}>
        <SurfaceCard
            kind="list"
            label={props.props.title}
            fact={props.props.eyebrow}
            headingLevel={2}
            footer={props.props.lead}
            items={props.props.steps.map((step, index): ListRowData => ({
                id: step.id,
                title: step.title,
                leading: { position: index + 1 },
                description: step.text,
                ...(step.isHumanStep ? { badges: [{ label: props.props.humanTag, tone: "neutral" }] } : {}),
                detail: (
                    <Cluster gap="inline">
                        <IconGlyph name={step.icon} isTile />
                        <Text size="sm" isStrong>{`${step.stepLabel} · ${step.agentName}`}</Text>
                        {step.hasAiMark ? <Badge tone="neutral">{props.props.aiMark}</Badge> : null}
                    </Cluster>
                ),
            }))}
            empty={<EmptyNotice message={props.props.emptyLabel} />}
        />
    </div>
)

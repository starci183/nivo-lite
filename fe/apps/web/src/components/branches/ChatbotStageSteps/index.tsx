import { Divider, Region, SectionHeader, Stepper } from "@starci/grammar/common"
import { SECTION_CLASS_NAME } from "./classNames"

/** Where the deal stands: the five steps of the one customer record. */
export interface ChatbotStageStepsProps {
    readonly title: string
    readonly label: string
    readonly steps: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly currentId: string
}

/** The stage band of the customer pane, the same on the Chatbot desk and the Sales desk. */
export const ChatbotStageSteps = (props: ChatbotStageStepsProps) => (
    <Region label={props.title}>
        <div className={SECTION_CLASS_NAME}>
            <SectionHeader level={3} title={props.title} />
            <Stepper label={props.label} orientation="vertical" steps={props.steps} currentStepId={props.currentId} />
        </div>
        <Divider semantics="presentation" />
    </Region>
)

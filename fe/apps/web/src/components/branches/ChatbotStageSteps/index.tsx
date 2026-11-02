import type { ChatbotStageStepsView } from "@/modules/types"
import { Stepper, Section } from "@starci/grammar/common"
/** Where the deal stands: the five steps of the one customer record. */
type ChatbotStageStepsProps = ChatbotStageStepsView
/** The stage band of the customer pane, the same on the Chatbot desk and the Sales desk. */
export const ChatbotStageSteps = (props: ChatbotStageStepsProps) => (
    <Section title={props.title} headingLevel={3}>
        <Stepper label={props.label} orientation="vertical" steps={props.steps} currentStepId={props.currentId} />
    </Section>
)

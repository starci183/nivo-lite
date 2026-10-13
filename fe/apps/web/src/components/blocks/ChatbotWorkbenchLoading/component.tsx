import { AgentDashboardFrame } from "@/features/agent-dashboard"

/** The words that stay real while the data loads. */
interface ChatbotWorkbenchLoadingBaseProps {
    readonly props: {
        readonly figureTerms: ReadonlyArray<{ readonly id: string; readonly term: string }>
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
}

/** The frame with no data yet: the four figure terms and the tab label are real, values and lists are skeleton. */
export const ChatbotWorkbenchLoadingBase = (props: ChatbotWorkbenchLoadingBaseProps) => (
    <AgentDashboardFrame
        module="chatbot"
        isLoading
        figures={props.props.figureTerms.map((figure) => ({ id: figure.id, term: figure.term, description: "" }))}
        tabs={props.props.tabs}
    />
)

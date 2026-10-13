import { WaitingRegion } from "@/components/composites/WaitingRegion"
import type { WaitingRegionProps } from "@/components/composites/WaitingRegion"

/** Props for {@link ChatbotWaitingBase}. */
export interface ChatbotWaitingBaseProps {
    readonly props: Omit<WaitingRegionProps, "onRetry">
    readonly on: { readonly retry: () => void }
}

/** Draws the "waiting for you" card of the Chatbot workbench: the conversations that wait for a person. */
export const ChatbotWaitingBase = (props: ChatbotWaitingBaseProps) => (
    <WaitingRegion {...props.props} onRetry={props.on.retry} />
)

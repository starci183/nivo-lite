import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link ChatbotFiguresBase}. */
export interface ChatbotFiguresBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the ribbon of the Chatbot workbench: conversations today, waiting, first reply and leads captured. */
export const ChatbotFiguresBase = (props: ChatbotFiguresBaseProps) => <FiguresStrip {...props.props} />

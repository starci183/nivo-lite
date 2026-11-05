import type { ReactNode } from "react"
import type { conversationBlock } from "../../blocks/conversation.block"
import { ConversationPane } from "../composites/ConversationPane"
import { ConversationPick } from "../composites/ConversationPick"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/**
 * The messages of the thread the spec param names, with a composer under them. The pane is keyed by the thread, so a draft and the
 * sends in flight stay with the thread they were written in.
 */
export const ConversationBlock = (props: RenderOf<typeof conversationBlock>): ReactNode => {
    const words = useBlockWords()
    const threadId = props.params.value(props.props.selectParam)
    if (threadId === null) {
        return <ConversationPick label={words(props.props.label)} message={words(props.props.pick)} />
    }
    return <ConversationPane key={threadId} threadId={threadId} props={props.props} slots={props.slots} />
}

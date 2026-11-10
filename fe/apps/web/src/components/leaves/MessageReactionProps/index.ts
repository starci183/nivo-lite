import type {
    BubbleReactionProps,
    MessageReactionActions,
    TeamChatMessageRow,
    TeamChatReactionCopy,
} from "@/modules/types"

/**
 * The reaction props of one message. The one place that names them: the bubble and the card spread this object, so a Grammar that
 * has not yet got the props ignores them and one that has draws the toolbar, the pill and the grouped corners.
 */
export const bubbleReactionPropsOf = (
    row: TeamChatMessageRow,
    copy: TeamChatReactionCopy,
    actions: MessageReactionActions,
): BubbleReactionProps => ({
    groupPosition: row.groupPosition,
    reactions: row.reactions,
    ...(actions.onReact === undefined ? {} : { onReact: (emoji: string) => actions.onReact?.(row.id, emoji) }),
    ...(actions.onReply === undefined ? {} : { onReply: () => actions.onReply?.(row.id) }),
    ...(actions.onShare === undefined ? {} : { onShare: () => actions.onShare?.(row.id) }),
    reactionLabels: {
        toolbar: copy.toolbar,
        reply: copy.reply,
        share: copy.share,
        react: copy.react,
        pill: copy.pill,
    },
})

import type { MessagePaths } from "./conversation.types"

/** The fields of a line of `blocks-core.chatbot.api.message.list`: the inbox reads the thread through them, no spec names them. */
export const THREAD_LINE_FIELDS: MessagePaths = {
    idPath: "id",
    textPath: "text",
    authorPath: "who",
    timePath: "at",
    statusPath: "state",
    sidePath: "side",
    markPath: "mark",
    filesPath: "files",
    orderPath: "order",
}

/** The fields of the record of `blocks-core.chatbot.api.chat.get` that head the thread and fill the contact pane. */
export const THREAD_FIELDS = {
    id: "id",
    name: "name",
    channelName: "channelName",
    avatarUrl: "avatarUrl",
    handledBy: "handledBy",
    contactId: "contactId",
} as const

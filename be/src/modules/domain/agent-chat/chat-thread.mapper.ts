import type { AgentThreadMessage } from "@modules/domain/agent-messages"
import { filesOfMessage } from "@modules/domain/chat-files"
import type { ChatFileView } from "@modules/domain/chat-files"
import type { AgentChatMessage } from "./agent-chat.contracts"

/** The thread with the files that came with each message. */
export const withFiles = (
    messages: ReadonlyArray<AgentThreadMessage>,
    files: ReadonlyArray<ChatFileView>,
): ReadonlyArray<AgentChatMessage> =>
    messages.map((message) => ({ ...message, files: filesOfMessage(files, message.id) }))

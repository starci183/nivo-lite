import type { DynamicModule } from "@nestjs/common"
import { ChatbotGraphqlModule } from "@features/api/chatbot"
import { ChatReplyGraphqlModule } from "@features/api/chatreply"
import { ChatbotWorkbenchModule } from "@modules/domain/chatbot-workbench"
import { CHATREPLY_ERROR_KINDS, CHATREPLY_MESSAGES, ChatReplyModule } from "@modules/domain/chatreply"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The customer chat area of the API, in registration order. */
export const salesModules = (): Array<DynamicModule> => [
    ChatReplyModule.register({ isGlobal: true }),
    ChatbotWorkbenchModule.register({ isGlobal: true }),
    ChatbotGraphqlModule.register({}),
    ChatReplyGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const salesErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [CHATREPLY_ERROR_KINDS]

/** The message bundles of the capabilities this group registers, in registration order. */
export const salesMessages: ReadonlyArray<MessageBundle> = [CHATREPLY_MESSAGES]

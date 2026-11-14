import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { inboxBlock } from "./inbox.block"
import { rulesBlock } from "./rules.block"

/** The blocks of the Chatbot module: the inbox and the rules form. */
export const chatbotBlocks: ReadonlyArray<BlockDefinition> = [inboxBlock, rulesBlock]

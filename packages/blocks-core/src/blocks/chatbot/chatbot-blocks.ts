import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { approvalCardBlock } from "./approval-card.block"
import { inboxBlock } from "./inbox.block"
import { rulesBlock } from "./rules.block"

/** The blocks of the Chatbot module: the inbox, the approval card inside its thread, and the rules form. */
export const chatbotBlocks: ReadonlyArray<BlockDefinition> = [inboxBlock, approvalCardBlock, rulesBlock]

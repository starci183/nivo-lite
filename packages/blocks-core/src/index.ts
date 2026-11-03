import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { cardGridBlock } from "./blocks/card-grid.block"
import { dashboardCardsBlock } from "./blocks/dashboard-cards.block"
import { decisionQueueBlock } from "./blocks/decision-queue.block"
import { detailBlock } from "./blocks/detail.block"
import { explanationBlock } from "./blocks/explanation.block"
import { figuresBlock } from "./blocks/figures.block"
import { masterDetailBlock } from "./blocks/master-detail.block"
import { recordListBlock } from "./blocks/record-list.block"
import { sectionBlock } from "./blocks/section.block"
import { stackBlock } from "./blocks/stack.block"
import { waitingBlock } from "./blocks/waiting.block"

export {
    cardGridBlock,
    dashboardCardsBlock,
    decisionQueueBlock,
    detailBlock,
    explanationBlock,
    figuresBlock,
    masterDetailBlock,
    recordListBlock,
    sectionBlock,
    stackBlock,
    waitingBlock,
}

/** The definitions of every core block, React-free so the back end validates specs against them without loading React. */
export const coreBlocks: ReadonlyArray<BlockDefinition> = [
    stackBlock,
    cardGridBlock,
    sectionBlock,
    figuresBlock,
    detailBlock,
    recordListBlock,
    waitingBlock,
    decisionQueueBlock,
    dashboardCardsBlock,
    masterDetailBlock,
    explanationBlock,
]

export { coreNodes } from "./nodes"
export { DEFAULT_THRESHOLD_VND } from "./nodes/order/confirm.node"
export { transferContentOf, vietQrUrl, paymentRequestOf } from "./nodes/payment/payment-request.policy"

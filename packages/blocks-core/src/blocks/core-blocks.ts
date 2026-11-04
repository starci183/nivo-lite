import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { cardGridBlock } from "./card-grid.block"
import { dashboardCardsBlock } from "./dashboard-cards.block"
import { decisionQueueBlock } from "./decision-queue.block"
import { detailBlock } from "./detail.block"
import { explanationBlock } from "./explanation.block"
import { figuresBlock } from "./figures.block"
import { masterDetailBlock } from "./master-detail.block"
import { recordListBlock } from "./record-list.block"
import { sectionBlock } from "./section.block"
import { stackBlock } from "./stack.block"
import { waitingBlock } from "./waiting.block"

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

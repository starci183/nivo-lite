import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { accountingBlocks } from "./accounting/accounting-blocks"
import { asideDetailBlock } from "./aside-detail.block"
import { boardBlock } from "./board.block"
import { cardGridBlock } from "./card-grid.block"
import { chatbotBlocks } from "./chatbot/chatbot-blocks"
import { dashboardCardsBlock } from "./dashboard-cards.block"
import { decisionQueueBlock } from "./decision-queue.block"
import { detailBlock } from "./detail.block"
import { explanationBlock } from "./explanation.block"
import { figuresBlock } from "./figures.block"
import { filterTabsBlock } from "./filter-tabs.block"
import { formBlock } from "./form.block"
import { listCardBlock } from "./list-card.block"
import { listEditorBlock } from "./list-editor.block"
import { listPaneBlock } from "./list-pane.block"
import { masterDetailBlock } from "./master-detail.block"
import { recordListBlock } from "./record-list.block"
import { sectionBlock } from "./section.block"
import { stackBlock } from "./stack.block"
import { tabbedPanelBlock } from "./tabbed-panel.block"
import { tableBlock } from "./table.block"
import { graphBlock } from "./graph.block"
import { runTimelineBlock } from "./run-timeline.block"
import { waitingBlock } from "./waiting.block"
import { loyaltyBlocks } from "./loyalty/loyalty-blocks"
import { salesBlocks } from "./sales/sales-blocks"

/** The definitions of every core block and of the blocks of each module, React-free so the back end validates specs against them without loading React. */
export const coreBlocks: ReadonlyArray<BlockDefinition> = [
    stackBlock,
    cardGridBlock,
    sectionBlock,
    figuresBlock,
    detailBlock,
    recordListBlock,
    listCardBlock,
    listPaneBlock,
    filterTabsBlock,
    tableBlock,
    boardBlock,
    formBlock,
    listEditorBlock,
    tabbedPanelBlock,
    asideDetailBlock,
    ...chatbotBlocks,
    waitingBlock,
    decisionQueueBlock,
    dashboardCardsBlock,
    masterDetailBlock,
    explanationBlock,
    graphBlock,
    runTimelineBlock,
    ...salesBlocks,
    ...loyaltyBlocks,
    ...accountingBlocks,
]

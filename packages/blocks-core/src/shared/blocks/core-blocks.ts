import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { accountingBlocks } from "../../agents/sales/ledger/workbench/blocks/accounting-blocks"
import { agentFlowsBlock } from "./agent-flows.block"
import { agentMessageBlock } from "./agent-message.block"
import { asideDetailBlock } from "./aside-detail.block"
import { boardBlock } from "./board.block"
import { cardGridBlock } from "./card-grid.block"
import { chatbotBlocks } from "../../agents/chatbot/workbench/blocks/chatbot-blocks"
import { dashboardCardsBlock } from "./dashboard-cards.block"
import { dataSetsBlock } from "./data-sets.block"
import { decisionQueueBlock } from "./decision-queue.block"
import { detailBlock } from "./detail.block"
import { explanationBlock } from "./explanation.block"
import { filePreviewBlock } from "./file-preview.block"
import { fileUploadBlock } from "./file-upload.block"
import { figuresBlock } from "./figures.block"
import { formBlock } from "./form.block"
import { linkBlock } from "./link.block"
import { listCardBlock } from "./list-card.block"
import { listEditorBlock } from "./list-editor.block"
import { masterDetailBlock } from "./master-detail.block"
import { reachCardBlock } from "./reach-card.block"
import { recordListBlock } from "./record-list.block"
import { sectionBlock } from "./section.block"
import { stackBlock } from "./stack.block"
import { tabbedPanelBlock } from "./tabbed-panel.block"
import { tableBlock } from "./table.block"
import { graphBlock } from "./graph.block"
import { runTimelineBlock } from "./run-timeline.block"
import { waitingBlock } from "./waiting.block"
import { loyaltyBlocks } from "../../agents/sales/loyalty/workbench/blocks/loyalty-blocks"
import { salesBlocks } from "../../agents/sales/workbench/blocks/sales-blocks"

/** The definitions of every core block and of the blocks of each module, React-free so the back end validates specs against them without loading React. */
export const coreBlocks: ReadonlyArray<BlockDefinition> = [
    stackBlock,
    linkBlock,
    cardGridBlock,
    sectionBlock,
    figuresBlock,
    detailBlock,
    recordListBlock,
    listCardBlock,
    tableBlock,
    boardBlock,
    formBlock,
    fileUploadBlock,
    filePreviewBlock,
    listEditorBlock,
    tabbedPanelBlock,
    asideDetailBlock,
    ...chatbotBlocks,
    waitingBlock,
    decisionQueueBlock,
    agentMessageBlock,
    dashboardCardsBlock,
    masterDetailBlock,
    explanationBlock,
    graphBlock,
    runTimelineBlock,
    agentFlowsBlock,
    reachCardBlock,
    dataSetsBlock,
    ...salesBlocks,
    ...loyaltyBlocks,
    ...accountingBlocks,
]

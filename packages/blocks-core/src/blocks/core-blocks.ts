import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { asideDetailBlock } from "./aside-detail.block"
import { boardBlock } from "./board.block"
import { cardGridBlock } from "./card-grid.block"
import { conversationBlock } from "./conversation.block"
import { dashboardCardsBlock } from "./dashboard-cards.block"
import { decisionQueueBlock } from "./decision-queue.block"
import { detailBlock } from "./detail.block"
import { explanationBlock } from "./explanation.block"
import { figuresBlock } from "./figures.block"
import { filterTabsBlock } from "./filter-tabs.block"
import { formBlock } from "./form.block"
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

/** The definitions of every core block, React-free so the back end validates specs against them without loading React. */
export const coreBlocks: ReadonlyArray<BlockDefinition> = [
    stackBlock,
    cardGridBlock,
    sectionBlock,
    figuresBlock,
    detailBlock,
    recordListBlock,
    listPaneBlock,
    filterTabsBlock,
    tableBlock,
    boardBlock,
    formBlock,
    listEditorBlock,
    tabbedPanelBlock,
    asideDetailBlock,
    conversationBlock,
    waitingBlock,
    decisionQueueBlock,
    dashboardCardsBlock,
    masterDetailBlock,
    explanationBlock,
    graphBlock,
    runTimelineBlock,
]

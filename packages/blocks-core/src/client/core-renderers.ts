import { defineRenderer } from "@nivo-lite/agent-sdk/client"
import type { BlockRenderer } from "@nivo-lite/agent-sdk/client"
import {
    asideDetailBlock,
    cardGridBlock,
    conversationBlock,
    filterTabsBlock,
    formBlock,
    listEditorBlock,
    listPaneBlock,
    tabbedPanelBlock,
    tableBlock,
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
} from "../index"
import { boardBlock } from "../blocks/board.block"
import { graphBlock } from "../blocks/graph.block"
import { runTimelineBlock } from "../blocks/run-timeline.block"
import { AsideDetailBlock } from "./blocks/AsideDetailBlock"
import { BoardBlock } from "./blocks/BoardBlock"
import { CardGridBlock } from "./blocks/CardGridBlock"
import { ConversationBlock } from "./blocks/ConversationBlock"
import { FilterTabsBlock } from "./blocks/FilterTabsBlock"
import { FormBlock } from "./blocks/FormBlock"
import { ListEditorBlock } from "./blocks/ListEditorBlock"
import { ListPaneBlock } from "./blocks/ListPaneBlock"
import { TabbedPanelBlock } from "./blocks/TabbedPanelBlock"
import { TableBlock } from "./blocks/TableBlock"
import { GraphBlock } from "./blocks/GraphBlock"
import { RunTimelineBlock } from "./blocks/RunTimelineBlock"
import { DashboardCardsBlock } from "./blocks/DashboardCardsBlock"
import { DecisionQueueBlock } from "./blocks/DecisionQueueBlock"
import { DetailBlock } from "./blocks/DetailBlock"
import { ExplanationBlock } from "./blocks/ExplanationBlock"
import { FiguresBlock } from "./blocks/FiguresBlock"
import { MasterDetailBlock } from "./blocks/MasterDetailBlock"
import { RecordListBlock } from "./blocks/RecordListBlock"
import { SectionBlock } from "./blocks/SectionBlock"
import { StackBlock } from "./blocks/StackBlock"
import { WaitingBlock } from "./blocks/WaitingBlock"
import { loyaltyRenderers } from "./loyalty/loyalty-renderers"
import { salesRenderers } from "./sales/sales-renderers"

/** The components of every core block, one per definition of the root export; the app hands them to the spec renderer. */
export const coreBlocks: ReadonlyArray<BlockRenderer> = [
    defineRenderer(stackBlock, StackBlock),
    defineRenderer(cardGridBlock, CardGridBlock),
    defineRenderer(sectionBlock, SectionBlock),
    defineRenderer(figuresBlock, FiguresBlock),
    defineRenderer(detailBlock, DetailBlock),
    defineRenderer(recordListBlock, RecordListBlock),
    defineRenderer(listPaneBlock, ListPaneBlock),
    defineRenderer(filterTabsBlock, FilterTabsBlock),
    defineRenderer(tableBlock, TableBlock),
    defineRenderer(boardBlock, BoardBlock),
    defineRenderer(formBlock, FormBlock),
    defineRenderer(listEditorBlock, ListEditorBlock),
    defineRenderer(tabbedPanelBlock, TabbedPanelBlock),
    defineRenderer(asideDetailBlock, AsideDetailBlock),
    defineRenderer(conversationBlock, ConversationBlock),
    defineRenderer(waitingBlock, WaitingBlock),
    defineRenderer(decisionQueueBlock, DecisionQueueBlock),
    defineRenderer(dashboardCardsBlock, DashboardCardsBlock),
    defineRenderer(masterDetailBlock, MasterDetailBlock),
    defineRenderer(explanationBlock, ExplanationBlock),
    defineRenderer(graphBlock, GraphBlock),
    defineRenderer(runTimelineBlock, RunTimelineBlock),
    ...salesRenderers,
    ...loyaltyRenderers,
]

import { defineRenderer } from "@nivo-lite/agent-sdk/client"
import type { BlockRenderer } from "@nivo-lite/agent-sdk/client"
import {
    asideDetailBlock,
    cardGridBlock,
    formBlock,
    listEditorBlock,
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
import { approvalCardBlock } from "../blocks/chatbot/approval-card.block"
import { inboxBlock } from "../blocks/chatbot/inbox.block"
import { rulesBlock } from "../blocks/chatbot/rules.block"
import { ApprovalCardBlock } from "./chatbot/ApprovalCardBlock"
import { InboxBlock } from "./chatbot/InboxBlock"
import { RulesBlock } from "./chatbot/RulesBlock"
import { accountingRenderers } from "./accounting/accounting-renderers"
import { AsideDetailBlock } from "./blocks/AsideDetailBlock"
import { BoardBlock } from "./blocks/BoardBlock"
import { CardGridBlock } from "./blocks/CardGridBlock"
import { FormBlock } from "./blocks/FormBlock"
import { ListEditorBlock } from "./blocks/ListEditorBlock"
import { listCardBlock } from "../blocks/list-card.block"
import { ListCardBlock } from "./blocks/ListCardBlock"
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
    defineRenderer(listCardBlock, ListCardBlock),
    defineRenderer(tableBlock, TableBlock),
    defineRenderer(boardBlock, BoardBlock),
    defineRenderer(formBlock, FormBlock),
    defineRenderer(listEditorBlock, ListEditorBlock),
    defineRenderer(tabbedPanelBlock, TabbedPanelBlock),
    defineRenderer(asideDetailBlock, AsideDetailBlock),
    defineRenderer(inboxBlock, InboxBlock),
    defineRenderer(approvalCardBlock, ApprovalCardBlock),
    defineRenderer(rulesBlock, RulesBlock),
    defineRenderer(waitingBlock, WaitingBlock),
    defineRenderer(decisionQueueBlock, DecisionQueueBlock),
    defineRenderer(dashboardCardsBlock, DashboardCardsBlock),
    defineRenderer(masterDetailBlock, MasterDetailBlock),
    defineRenderer(explanationBlock, ExplanationBlock),
    defineRenderer(graphBlock, GraphBlock),
    defineRenderer(runTimelineBlock, RunTimelineBlock),
    ...salesRenderers,
    ...loyaltyRenderers,
    ...accountingRenderers,
]

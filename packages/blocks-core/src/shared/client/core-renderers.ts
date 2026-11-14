import { defineRenderer, type BlockRenderer } from "@nivo-lite/agent-sdk/client"
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
} from "../../index"
import { agentFlowsBlock } from "../blocks/agent-flows.block"
import { boardBlock } from "../blocks/board.block"
import { filePreviewBlock } from "../blocks/file-preview.block"
import { fileUploadBlock } from "../blocks/file-upload.block"
import { dataSetsBlock } from "../blocks/data-sets.block"
import { reachCardBlock } from "../blocks/reach-card.block"
import { graphBlock } from "../blocks/graph.block"
import { runTimelineBlock } from "../blocks/run-timeline.block"
import { agentMessageBlock } from "../blocks/agent-message.block"
import { inboxBlock } from "../../agents/chatbot/workbench/blocks/inbox.block"
import { rulesBlock } from "../../agents/chatbot/workbench/blocks/rules.block"
import { AgentMessageBlock } from "./agent-message/AgentMessageBlock"
import { InboxBlock } from "../../agents/chatbot/workbench/client/InboxBlock"
import { RulesBlock } from "../../agents/chatbot/workbench/client/RulesBlock"
import { accountingRenderers } from "../../agents/sales/ledger/workbench/client/accounting-renderers"
import { AgentFlowsBlock } from "./blocks/AgentFlowsBlock"
import { AsideDetailBlock } from "./blocks/AsideDetailBlock"
import { DataSetsBlock } from "./blocks/DataSetsBlock"
import { ReachCardBlock } from "./blocks/ReachCardBlock"
import { BoardBlock } from "./blocks/BoardBlock"
import { CardGridBlock } from "./blocks/CardGridBlock"
import { FilePreviewBlock } from "./blocks/FilePreviewBlock"
import { FileUploadBlock } from "./blocks/FileUploadBlock"
import { FormBlock } from "./blocks/FormBlock"
import { ListEditorBlock } from "./blocks/ListEditorBlock"
import { linkBlock } from "../blocks/link.block"
import { listCardBlock } from "../blocks/list-card.block"
import { LinkBlock } from "./blocks/LinkBlock"
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
import { loyaltyRenderers } from "../../agents/sales/loyalty/workbench/client/loyalty-renderers"
import { salesRenderers } from "../../agents/sales/workbench/client/sales-renderers"

/** The components of every core block, one per definition of the root export; the app hands them to the spec renderer. */
export const coreBlocks: ReadonlyArray<BlockRenderer> = [
    defineRenderer(stackBlock, StackBlock),
    defineRenderer(linkBlock, LinkBlock),
    defineRenderer(cardGridBlock, CardGridBlock),
    defineRenderer(sectionBlock, SectionBlock),
    defineRenderer(figuresBlock, FiguresBlock),
    defineRenderer(detailBlock, DetailBlock),
    defineRenderer(recordListBlock, RecordListBlock),
    defineRenderer(listCardBlock, ListCardBlock),
    defineRenderer(tableBlock, TableBlock),
    defineRenderer(boardBlock, BoardBlock),
    defineRenderer(formBlock, FormBlock),
    defineRenderer(fileUploadBlock, FileUploadBlock),
    defineRenderer(filePreviewBlock, FilePreviewBlock),
    defineRenderer(listEditorBlock, ListEditorBlock),
    defineRenderer(tabbedPanelBlock, TabbedPanelBlock),
    defineRenderer(asideDetailBlock, AsideDetailBlock),
    defineRenderer(inboxBlock, InboxBlock),
    defineRenderer(rulesBlock, RulesBlock),
    defineRenderer(waitingBlock, WaitingBlock),
    defineRenderer(decisionQueueBlock, DecisionQueueBlock),
    defineRenderer(agentMessageBlock, AgentMessageBlock),
    defineRenderer(dashboardCardsBlock, DashboardCardsBlock),
    defineRenderer(masterDetailBlock, MasterDetailBlock),
    defineRenderer(explanationBlock, ExplanationBlock),
    defineRenderer(graphBlock, GraphBlock),
    defineRenderer(runTimelineBlock, RunTimelineBlock),
    defineRenderer(agentFlowsBlock, AgentFlowsBlock),
    defineRenderer(reachCardBlock, ReachCardBlock),
    defineRenderer(dataSetsBlock, DataSetsBlock),
    ...salesRenderers,
    ...loyaltyRenderers,
    ...accountingRenderers,
]

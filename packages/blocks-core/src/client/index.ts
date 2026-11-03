import { defineRenderer } from "@nivo-lite/agent-sdk/client"
import type { BlockRenderer } from "@nivo-lite/agent-sdk/client"
import {
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
} from "../index"
import { CardGridBlock } from "./blocks/CardGridBlock"
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

/** The components of every core block, one per definition of the root export; the app hands them to the spec renderer. */
export const coreBlocks: ReadonlyArray<BlockRenderer> = [
    defineRenderer(stackBlock, StackBlock),
    defineRenderer(cardGridBlock, CardGridBlock),
    defineRenderer(sectionBlock, SectionBlock),
    defineRenderer(figuresBlock, FiguresBlock),
    defineRenderer(detailBlock, DetailBlock),
    defineRenderer(recordListBlock, RecordListBlock),
    defineRenderer(waitingBlock, WaitingBlock),
    defineRenderer(decisionQueueBlock, DecisionQueueBlock),
    defineRenderer(dashboardCardsBlock, DashboardCardsBlock),
    defineRenderer(masterDetailBlock, MasterDetailBlock),
    defineRenderer(explanationBlock, ExplanationBlock),
]

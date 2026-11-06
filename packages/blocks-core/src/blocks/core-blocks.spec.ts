import { asideDetailBlock } from "./aside-detail.block"
import { conversationBlock } from "./conversation.block"
import { filterTabsBlock } from "./filter-tabs.block"
import { formBlock } from "./form.block"
import { listEditorBlock } from "./list-editor.block"
import { loyaltyBlocks } from "./loyalty/loyalty-blocks"
import { salesBlocks } from "./sales/sales-blocks"
import { listPaneBlock } from "./list-pane.block"
import { tabbedPanelBlock } from "./tabbed-panel.block"
import { tableBlock } from "./table.block"
import { graphBlock } from "./graph.block"
import { runTimelineBlock } from "./run-timeline.block"
import { boardBlock } from "./board.block"
import { cardGridBlock } from "./card-grid.block"
import { coreBlocks } from "./core-blocks"
import { dashboardCardsBlock } from "./dashboard-cards.block"
import { decisionQueueBlock, QUEUE_SURFACES } from "./decision-queue.block"
import { detailBlock } from "./detail.block"
import { explanationBlock } from "./explanation.block"
import { figuresBlock } from "./figures.block"
import { masterDetailBlock } from "./master-detail.block"
import { recordListBlock } from "./record-list.block"
import { sectionBlock } from "./section.block"
import { STACK_GAPS, stackBlock } from "./stack.block"
import { waitingBlock } from "./waiting.block"

const WORD = { key: "word" }
const FACTS = { label: WORD, items: [{ term: WORD, path: "total" }] }
const EXPLANATION_WORDS = [
    "label",
    "listLabel",
    "waitingLabel",
    "doneLabel",
    "openLabel",
    "closeLabel",
    "pathLabel",
    "factsLabel",
    "sourcesLabel",
    "approverLabel",
    "timeLabel",
    "openOnMap",
    "missingTitle",
    "missingBody",
]

describe("coreBlocks", () => {
    it("lists every block once: the 22 core blocks and each agent's own, under the namespace of the agent", () => {
        const ids = coreBlocks.map((block) => block.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.filter((id) => id.startsWith("core."))).toHaveLength(22)
        expect(ids.filter((id) => !id.startsWith("core.")).every((id) => /^(sales|loyalty)\./.test(id))).toBe(true)
    })

    it("carries the JSON Schema of every block's props", () => {
        expect(coreBlocks.every((block) => Object.keys(block.propsJson).length > 0)).toBe(true)
    })

    it("holds the blocks a client draws, in the order a palette shows them", () => {
        expect(coreBlocks).toEqual([
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
            ...salesBlocks,
            ...loyaltyBlocks,
        ])
    })
})

describe("the props of the layout blocks", () => {
    it("lets a stack name one of its gap roles and refuses another", () => {
        expect(STACK_GAPS.every((gap) => stackBlock.props.safeParse({ gap }).success)).toBe(true)
        expect(stackBlock.props.safeParse({ gap: "huge" }).success).toBe(false)
    })

    it("takes no props for a card grid", () => {
        expect(cardGridBlock.props.safeParse({}).success).toBe(true)
        expect(cardGridBlock.children).toEqual({})
    })

    it("takes an optional hint for a section", () => {
        expect(sectionBlock.props.safeParse({ title: WORD }).success).toBe(true)
        expect(sectionBlock.props.safeParse({ title: WORD, hint: WORD }).success).toBe(true)
        expect(sectionBlock.props.safeParse({ hint: WORD }).success).toBe(false)
    })

    it("holds a list and a detail in a master detail", () => {
        expect(masterDetailBlock.props.safeParse({ emptyTitle: WORD, emptyBody: WORD }).success).toBe(true)
        expect(masterDetailBlock.children).toEqual({ max: 2 })
    })
})

describe("the props of the fact blocks", () => {
    it("take a label and term and path pairs", () => {
        expect(figuresBlock.props.safeParse(FACTS).success).toBe(true)
        expect(detailBlock.props.safeParse(FACTS).success).toBe(true)
    })

    it("refuse a path or a list past its bound", () => {
        const longPath = { label: WORD, items: [{ term: WORD, path: "p".repeat(201) }] }
        const manyItems = { label: WORD, items: Array.from({ length: 51 }, () => ({ term: WORD, path: "total" })) }
        for (const block of [figuresBlock, detailBlock]) {
            expect(block.props.safeParse(longPath).success).toBe(false)
            expect(block.props.safeParse(manyItems).success).toBe(false)
        }
    })
})

describe("the props of the list blocks", () => {
    const LIST = { label: WORD, empty: WORD, idPath: "id", titlePath: "title" }

    it("take the paths of a record list, the description and badge paths being optional", () => {
        expect(recordListBlock.props.safeParse(LIST).success).toBe(true)
        expect(
            recordListBlock.props.safeParse({
                ...LIST,
                descriptionPath: "note",
                badgePath: "state",
                metaPath: "when",
                chipPaths: ["channel"],
                avatar: true,
            }).success,
        ).toBe(true)
    })

    it("take the tones of a record list badge and refuse a tone it does not know", () => {
        expect(recordListBlock.props.safeParse({ ...LIST, badgeTones: { open: "success" } }).success).toBe(true)
        expect(recordListBlock.props.safeParse({ ...LIST, badgeTones: { open: "purple" } }).success).toBe(false)
    })

    it("refuse more record list chips than the bound", () => {
        expect(recordListBlock.props.safeParse({ ...LIST, chipPaths: ["a", "b", "c", "d"] }).success).toBe(false)
    })

    it("refuse a record list path past its bound", () => {
        expect(recordListBlock.props.safeParse({ ...LIST, idPath: "p".repeat(201) }).success).toBe(false)
        expect(recordListBlock.props.safeParse({ ...LIST, badgePath: "p".repeat(201) }).success).toBe(false)
    })

    it("take a surface and the words of a decision queue", () => {
        const queue = { label: WORD, emptyTitle: WORD, emptyBody: WORD, seeWhy: WORD, moreMenu: WORD }
        const accepts = (surface: string): boolean => decisionQueueBlock.props.safeParse({ ...queue, surface }).success
        expect(QUEUE_SURFACES.every(accepts)).toBe(true)
        expect(accepts("page")).toBe(false)
    })

    it("take one label for the waiting block and three for the dashboard cards", () => {
        expect(waitingBlock.props.safeParse({ label: WORD }).success).toBe(true)
        const labels = { doneLabel: WORD, connectionsLabel: WORD, knowledgeLabel: WORD }
        expect(dashboardCardsBlock.props.safeParse(labels).success).toBe(true)
    })

    it("take the words of an explanation", () => {
        const words = Object.fromEntries(EXPLANATION_WORDS.map((name) => [name, WORD]))
        expect(explanationBlock.props.safeParse(words).success).toBe(true)
        expect(explanationBlock.props.safeParse({ label: WORD }).success).toBe(false)
    })
})

describe("the slots of the blocks", () => {
    it("name the reads and actions a spec binds", () => {
        expect(Object.keys(explanationBlock.slots)).toEqual(["why", "waiting", "done", "close"])
        expect(decisionQueueBlock.slots.command).toEqual({ kind: "action", required: false })
        expect(recordListBlock.slots.rows).toEqual({ kind: "read", shape: "list", required: true })
        expect(Object.keys(dashboardCardsBlock.slots)).toEqual(["done", "connections", "knowledge"])
        expect(Object.keys(waitingBlock.slots)).toEqual(["region"])
    })
})

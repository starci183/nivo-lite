import { PageContainer, Text, TextAction } from "@starci/grammar/common"
import { BrainAgentView } from "@/components/blocks/BrainAgentView"
import { BrainFactForm } from "@/components/blocks/BrainFactForm"
import { BrainFacts } from "@/components/blocks/BrainFacts"
import { BrainGaps } from "@/components/blocks/BrainGaps"
import { BrainLessons } from "@/components/blocks/BrainLessons"
import { BrainPipeline } from "@/components/blocks/BrainPipeline"
import { BrainReview } from "@/components/blocks/BrainReview"
import { BrainTabs } from "@/components/blocks/BrainTabs"
import { KnowledgeAdd } from "@/components/blocks/KnowledgeAdd"
import { KnowledgeAsk } from "@/components/blocks/KnowledgeAsk"
import { KnowledgeLibrary } from "@/components/blocks/KnowledgeLibrary"
import { KnowledgeSuggestions } from "@/components/blocks/KnowledgeSuggestions"
import { PageHeading } from "@/components/composites/PageHeading"
import type { AddPreset } from "@/hooks/knowledge"
import { BRAIN_PANEL_PREFIX } from "@/modules/brain"
import type { ModuleKey } from "@/modules/catalog"
import type { BrainTab } from "@/modules/routes"
import {
    PAGE_CLASS_NAME,
    PANEL_CLASS_NAME,
    SOURCES_CLASS_NAME,
    SOURCES_MAIN_CLASS_NAME,
    SOURCES_SIDE_CLASS_NAME,
} from "./classNames"

/** Copy and values the Second Brain page supplies. */
export interface BrainPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly title: string
        readonly description: string
        readonly nivoLabel: string
        readonly nivoHref: string
        readonly readOnlyNote: string
        /** The tab the address asks for. */
        readonly tab: BrainTab
        /** What the address asks of the fact form: the fact being written, a fact to give a new value, a question to answer. */
        readonly fact: string | undefined
        readonly edit: string | undefined
        readonly answer: string | undefined
        /** The agent the documents are filtered to. */
        readonly module: ModuleKey | "all"
        /** Whether the address asks for the add drawer to be open, and what it was opened from. */
        readonly isAddOpen: boolean
        readonly addKey: string
        readonly addPreset: AddPreset | null
    }
}

/** Draws the open tab of the Second Brain. */
const Panel = (props: BrainPageBaseProps) => {
    const page = props.props
    if (page.tab === "review") return <BrainReview />
    if (page.tab === "facts") {
        return (
            <>
                <BrainFacts />
                <BrainFactForm tab="facts" fact={page.fact} edit={page.edit} answer={page.answer} />
            </>
        )
    }
    if (page.tab === "lessons") return <BrainLessons />
    if (page.tab === "gaps") {
        return (
            <>
                <BrainGaps />
                <BrainFactForm tab="gaps" fact={page.fact} edit={page.edit} answer={page.answer} />
            </>
        )
    }
    if (page.tab === "agents") {
        return (
            <>
                <BrainAgentView />
                <KnowledgeAsk />
            </>
        )
    }
    return (
        <div className={SOURCES_CLASS_NAME}>
            <div className={SOURCES_MAIN_CLASS_NAME}>
                <KnowledgeAdd
                    key={page.addKey}
                    readOnlyNote={page.readOnlyNote}
                    module={page.module}
                    isOpen={page.isAddOpen}
                    preset={page.addPreset}
                />
                <KnowledgeLibrary module={page.module} />
            </div>
            <div className={SOURCES_SIDE_CLASS_NAME}>
                <KnowledgeSuggestions />
                <Text>
                    <TextAction href={page.nivoHref}>{page.nivoLabel}</TextAction>
                </Text>
            </div>
        </div>
    )
}

/** Draws the Second Brain: its pipeline, then the tab the address asks for (sources, review, facts, lessons, questions, what each agent sees). */
export const BrainPageBase = (props: BrainPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <PageHeading
                crumbLabel={props.props.crumbLabel}
                crumbs={[
                    { id: "home", label: props.props.crumbHome, href: props.props.homeHref },
                    { id: "brain", label: props.props.title },
                ]}
                title={props.props.title}
                description={props.props.description}
            />
            <BrainPipeline />
            <BrainTabs selected={props.props.tab} />
            <div className={PANEL_CLASS_NAME} role="tabpanel" id={`${BRAIN_PANEL_PREFIX}${props.props.tab}`}>
                <Panel {...props} />
            </div>
        </div>
    </PageContainer>
)

import { Text, TextAction } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { BrainDossiers } from "@/components/blocks/BrainDossiers"
import { BrainAgentView } from "@/components/blocks/BrainAgentView"
import { BrainFactForm } from "@/components/blocks/BrainFactForm"
import { BrainFacts } from "@/components/blocks/BrainFacts"
import { BrainGaps } from "@/components/blocks/BrainGaps"
import { BrainLessons } from "@/components/blocks/BrainLessons"
import { BrainMap } from "@/components/blocks/BrainMap"
import { DossierFindings } from "@/components/blocks/DossierFindings"
import { DossierRemedyDraft } from "@/components/blocks/DossierRemedyDraft"
import { DossierTodo } from "@/components/blocks/DossierTodo"
import { BrainPipeline } from "@/components/blocks/BrainPipeline"
import { BrainReview } from "@/components/blocks/BrainReview"
import { BrainPageFrame } from "@/components/blocks/BrainPageFrame"
import { KnowledgeAdd } from "@/components/blocks/KnowledgeAdd"
import { KnowledgeAsk } from "@/components/blocks/KnowledgeAsk"
import { KnowledgeLibrary } from "@/components/blocks/KnowledgeLibrary"
import { KnowledgeSuggestions } from "@/components/blocks/KnowledgeSuggestions"
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

/** What the add drawer was opened from: the topic to write about, who may read it, the tags it files under and the mode it opens on. */
export interface AddPresetView {
    readonly topic: string
    readonly visibility?: "public" | "internal"
    readonly tags?: string
    readonly mode?: "files" | "write"
}

/** Copy and values the Second Brain page supplies. */
export interface BrainPageBaseProps {
    readonly props: {
        /** The header without its tabs: the frame adds them. */
        readonly header: PageHeaderContent
        readonly nivoLabel: string
        readonly nivoHref: string
        readonly readOnlyNote: string
        /** The tab the address asks for. */
        readonly tab: BrainTab
        /** What the address asks of the fact form: the fact being written, a fact to give a new value, a question to answer. */
        readonly fact: string | undefined
        readonly edit: string | undefined
        readonly answer: string | undefined
        /** The dossier open in the dossiers tab, the finding in view and the draft in the drawer. */
        readonly dossier: string | undefined
        readonly finding: string | undefined
        readonly draft: string | undefined
        /** The node selected on the map. */
        readonly node: string | undefined
        /** The agent the documents are filtered to. */
        readonly module: ModuleKey | "all"
        /** Whether the address asks for the add drawer to be open, and what it was opened from. */
        readonly isAddOpen: boolean
        readonly addKey: string
        readonly addPreset: AddPresetView | null
    }
}

/** Draws the open tab of the Second Brain. */
const Panel = (props: BrainPageBaseProps) => {
    const page = props.props
    if (page.tab === "todo") return <DossierTodo />
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

/**
 * Draws the Second Brain: its tabs on the header band, then the tab the address asks for. The dossiers tab is a panes page
 * (its grid attaches flush under the tab line); every other tab sits in the page measure under the pipeline (sources,
 * review, facts, lessons, questions, what each agent sees).
 */
export const BrainPageBase = (props: BrainPageBaseProps) => {
    const page = props.props
    if (page.tab === "dossiers") {
        return (
            <BrainDossiers
                header={page.header}
                dossier={page.dossier}
                detail={
                    page.dossier === undefined ? null : (
                        <DossierFindings dossierId={page.dossier} findingId={page.finding} />
                    )
                }
                draftDrawer={
                    <DossierRemedyDraft draftId={page.draft} dossierId={page.dossier} findingId={page.finding} />
                }
            />
        )
    }
    if (page.tab === "map") {
        return (
            <BrainMap
                header={page.header}
                node={page.node}
                findings={
                    page.node === undefined ? null : <DossierFindings dossierId={page.node} findingId={undefined} />
                }
            />
        )
    }
    return (
        <BrainPageFrame selected={page.tab} header={page.header}>
            <div className={PAGE_CLASS_NAME}>
                <BrainPipeline />
                <div className={PANEL_CLASS_NAME} role="tabpanel" id={`${BRAIN_PANEL_PREFIX}${page.tab}`}>
                    <Panel {...props} />
                </div>
            </div>
        </BrainPageFrame>
    )
}

import { Text, Link } from "@starci/grammar/common"
import type { BrainPageHeading } from "@/modules/types"
import { BrainDossiers } from "@/components/blocks/BrainDossiers"
import { BrainAgentView } from "@/components/blocks/BrainAgentView"
import { BrainFactForm } from "@/components/blocks/BrainFactForm"
import { BrainFacts } from "@/components/blocks/BrainFacts"
import { BrainGaps } from "@/components/blocks/BrainGaps"
import { BrainLessons } from "@/components/blocks/BrainLessons"
import { BrainTodo } from "@/components/blocks/BrainTodo"
import { BrainPageFrame } from "@/components/blocks/BrainPageFrame"
import { KnowledgeAdd } from "@/components/blocks/KnowledgeAdd"
import { KnowledgeAsk } from "@/components/blocks/KnowledgeAsk"
import { KnowledgeLibrary } from "@/components/blocks/KnowledgeLibrary"
import { PublicDocDraft } from "@/components/blocks/PublicDocDraft"
import { PublicDocs } from "@/components/blocks/PublicDocs"
import { PublicDraftPicker } from "@/components/blocks/PublicDraftPicker"
import { PublicWriteForm } from "@/components/blocks/PublicWriteForm"
import { BrainNextReview } from "@/components/blocks/BrainNextReview"
import { KnowledgeProcessing } from "@/components/blocks/KnowledgeProcessing"
import { KnowledgeSuggestions } from "@/components/blocks/KnowledgeSuggestions"
import { BRAIN_PANEL_PREFIX } from "@/modules/brain"
import type { ModuleKey } from "@/modules/catalog"
import type { BrainTab } from "@/modules/routes"
import { PAGE_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** What the add form was opened from: the topic to write about, the tags it files under and the mode it opens on. */
export interface AddPresetView {
    readonly topic: string
    readonly tags?: string
    readonly mode?: "files" | "write"
}

/** Copy and values the Second Brain page supplies. */
export interface BrainPageBaseProps {
    readonly props: {
        /** The header without its tabs: the frame adds them. */
        readonly header: BrainPageHeading
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
        /** What the add form was opened from. */
        readonly addKey: string
        readonly addPreset: AddPresetView | null
        /** The public document form the address asks for. */
        readonly compose: "pick" | "write" | undefined
        /** The title the written form starts with: the customer question being answered. */
        readonly composeTitle: string
        /** The public document open as a draft. */
        readonly publicDoc: string | undefined
    }
}

/** Draws the open tab of the Second Brain. */
const Panel = (props: BrainPageBaseProps) => {
    const page = props.props
    if (page.tab === "facts") {
        return (
            <>
                <BrainFacts />
                <BrainFactForm tab="facts" fact={page.fact} edit={page.edit} answer={page.answer} />
            </>
        )
    }
    if (page.tab === "lessons") return <BrainLessons />
    if (page.tab === "publicDocs") {
        return (
            <>
                <PublicDocs />
                <PublicDraftPicker isOpen={page.compose === "pick"} />
                <PublicWriteForm
                    key={`write:${page.composeTitle}`}
                    isOpen={page.compose === "write"}
                    initialTitle={page.composeTitle}
                />
                <PublicDocDraft key={page.publicDoc} docId={page.publicDoc} />
            </>
        )
    }
    if (page.tab === "publicAsks") return <BrainGaps answer="public" />
    if (page.tab === "publicTry") return <KnowledgeAsk fixedAudience="customer" />
    if (page.tab === "agents") {
        return (
            <>
                <BrainAgentView />
                <KnowledgeAsk />
            </>
        )
    }
    return (
        <>
            <KnowledgeAdd
                key={page.addKey}
                readOnlyNote={page.readOnlyNote}
                module={page.module}
                preset={page.addPreset}
            />
            <KnowledgeProcessing />
            <BrainNextReview />
            <KnowledgeLibrary module={page.module} />
            <KnowledgeSuggestions />
            <Text>
                <Link href={page.nivoHref}>{page.nivoLabel}</Link>
            </Text>
        </>
    )
}

/**
 * Draws the Second Brain: its tabs on the header band, then the tab the address asks for. The map is a panes page (its grid
 * attaches flush under the tab line); every other tab sits in the page measure.
 */
export const BrainPageBase = (props: BrainPageBaseProps) => {
    const page = props.props
    if (page.tab === "todo") {
        return <BrainTodo header={page.header} fact={page.fact} edit={page.edit} answer={page.answer} />
    }
    if (page.tab === "dossiers") {
        return (
            <BrainDossiers
                header={page.header}
                mode="list"
                node={undefined}
                dossier={page.dossier}
                finding={page.finding}
                draft={page.draft}
            />
        )
    }
    if (page.tab === "map") {
        return (
            <BrainDossiers
                header={page.header}
                mode="map"
                node={page.node}
                dossier={undefined}
                finding={undefined}
                draft={undefined}
            />
        )
    }
    return (
        <BrainPageFrame selected={page.tab} header={page.header}>
            <div className={PAGE_CLASS_NAME}>
                <div className={PANEL_CLASS_NAME} role="tabpanel" id={`${BRAIN_PANEL_PREFIX}${page.tab}`}>
                    <Panel {...props} />
                </div>
            </div>
        </BrainPageFrame>
    )
}

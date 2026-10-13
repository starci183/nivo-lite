import { PageContainer, Text, TextAction } from "@starci/grammar/common"
import { KnowledgeAdd } from "@/components/blocks/KnowledgeAdd"
import { KnowledgeAsk } from "@/components/blocks/KnowledgeAsk"
import { KnowledgeLibrary } from "@/components/blocks/KnowledgeLibrary"
import { KnowledgeSuggestions } from "@/components/blocks/KnowledgeSuggestions"
import { PageHeading } from "@/components/composites/PageHeading"
import type { AddPreset, InstanceOption } from "@/hooks/knowledge"
import type { ModuleKey } from "@/modules/catalog"
import type { KnowledgeDocument, IdeaDecision } from "@/modules/types"
import { PAGE_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames"

/** One idea, by the key its words are stored under. */
interface IdeaView {
    readonly key: string
    readonly state?: IdeaDecision
}

/** Copy and values the documents page supplies. */
export interface KnowledgePageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly crumbBrain: string
        readonly brainHref: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly nivoLabel: string
        readonly nivoHref: string
        readonly readOnlyNote: string
        readonly workspaceId: string
        readonly canWrite: boolean
        readonly sources: ReadonlyArray<KnowledgeDocument>
        readonly module: ModuleKey | "all"
        readonly askModule: ModuleKey
        readonly instances: ReadonlyArray<InstanceOption>
        readonly open: ReadonlyArray<IdeaView>
        readonly skipped: ReadonlyArray<IdeaView>
        /** Whether the address asks for the add drawer to be open, and what it was opened from. */
        readonly isAddOpen: boolean
        readonly addKey: string
        readonly addPreset: AddPreset | null
        /** The same page while its data loads: headings and labels stay, documents and ideas are skeleton rows. */
        readonly isLoading: boolean
    }
}

/** Draws the documents page: the documents, the panel that tries a question, the ideas and the drawer that adds documents. */
export const KnowledgePageBase = (props: KnowledgePageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <PageHeading
                crumbLabel={props.props.crumbLabel}
                crumbs={[
                    { id: "home", label: props.props.crumbHome, href: props.props.homeHref },
                    { id: "brain", label: props.props.crumbBrain, href: props.props.brainHref },
                    { id: "docs", label: props.props.title },
                ]}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.description}
            />
            <div className={TOOLBAR_CLASS_NAME}>
                <Text>
                    <TextAction href={props.props.nivoHref}>{props.props.nivoLabel}</TextAction>
                </Text>
                {props.props.canWrite ? (
                    <KnowledgeAdd
                        key={props.props.addKey}
                        workspaceId={props.props.workspaceId}
                        instances={props.props.instances}
                        isOpen={props.props.isAddOpen}
                        preset={props.props.addPreset}
                    />
                ) : (
                    <Text size="sm" tone="muted">
                        {props.props.readOnlyNote}
                    </Text>
                )}
            </div>
            <KnowledgeLibrary
                workspaceId={props.props.workspaceId}
                sources={props.props.sources}
                canWrite={props.props.canWrite}
                module={props.props.module}
                isLoading={props.props.isLoading}
            />
            <KnowledgeAsk
                workspaceId={props.props.workspaceId}
                module={props.props.askModule}
                isLoading={props.props.isLoading}
            />
            {props.props.canWrite ? (
                <KnowledgeSuggestions
                    workspaceId={props.props.workspaceId}
                    open={props.props.open}
                    skipped={props.props.skipped}
                    isLoading={props.props.isLoading}
                />
            ) : null}
        </div>
    </PageContainer>
)

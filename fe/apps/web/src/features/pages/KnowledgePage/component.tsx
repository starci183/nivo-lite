import { PageContainer, Text, TextAction } from "@starci/grammar/common"
import { KnowledgeAdd } from "@/components/blocks/KnowledgeAdd"
import { KnowledgeAsk } from "@/components/blocks/KnowledgeAsk"
import { KnowledgeLibrary } from "@/components/blocks/KnowledgeLibrary"
import { KnowledgeSuggestions } from "@/components/blocks/KnowledgeSuggestions"
import { PageHeading } from "@/components/composites/PageHeading"
import type { AddPreset } from "@/hooks/knowledge"
import type { ModuleKey } from "@/modules/catalog"
import { PAGE_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames"

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
        readonly module: ModuleKey | "all"
        /** Whether the address asks for the add drawer to be open, and what it was opened from. */
        readonly isAddOpen: boolean
        readonly addKey: string
        readonly addPreset: AddPreset | null
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
                <KnowledgeAdd
                    key={props.props.addKey}
                    readOnlyNote={props.props.readOnlyNote}
                    isOpen={props.props.isAddOpen}
                    preset={props.props.addPreset}
                />
            </div>
            <KnowledgeLibrary module={props.props.module} />
            <KnowledgeAsk module={props.props.module} />
            <KnowledgeSuggestions />
        </div>
    </PageContainer>
)

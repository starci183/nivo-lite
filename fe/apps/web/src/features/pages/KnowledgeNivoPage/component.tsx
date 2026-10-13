import { KnowledgeNivo } from "@/components/blocks/KnowledgeNivo"
import { KnowledgeFrame } from "@/components/blocks/KnowledgeFrame"
import type { NivoEntry } from "@/modules/types"

/** Copy and values the base knowledge page supplies. */
export interface KnowledgeNivoPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly crumbBrain: string
        readonly brainHref: string
        readonly crumbDocuments: string
        readonly documentsHref: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly items: ReadonlyArray<NivoEntry>
        /** The same page while its data loads: the headings stay, the items are skeleton rows. */
        readonly isLoading: boolean
    }
}

/** Draws the base knowledge of NIVO under its trail and heading. */
export const KnowledgeNivoPageBase = (props: KnowledgeNivoPageBaseProps) => (
    <KnowledgeFrame
        crumbLabel={props.props.crumbLabel}
        crumbHome={props.props.crumbHome}
        homeHref={props.props.homeHref}
        crumbBrain={props.props.crumbBrain}
        brainHref={props.props.brainHref}
        crumbDocuments={props.props.crumbDocuments}
        documentsHref={props.props.documentsHref}
        title={props.props.title}
        eyebrow={props.props.eyebrow}
        description={props.props.description}
    >
        <KnowledgeNivo items={props.props.items} isLoading={props.props.isLoading} />
    </KnowledgeFrame>
)

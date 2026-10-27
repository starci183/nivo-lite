import { PageHeading } from "@/components/composites/PageHeading"

/** What the trail and the heading of a page under the documents draw. */
export interface KnowledgeFrameBaseProps {
    readonly props: {
        /** The accessible name of the trail. */
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly crumbBrain: string
        readonly brainHref: string
        readonly crumbDocuments: string
        readonly documentsHref: string
        /** The page itself, the last step of the trail. */
        readonly title: string
        readonly eyebrow: string
        readonly description: string
    }
}

/** The trail (home, Second Brain, documents, this page) and the heading of a page under the documents. */
export const KnowledgeFrameBase = (props: KnowledgeFrameBaseProps) => (
    <PageHeading
        crumbLabel={props.props.crumbLabel}
        crumbs={[
            { id: "home", label: props.props.crumbHome, href: props.props.homeHref },
            { id: "brain", label: props.props.crumbBrain, href: props.props.brainHref },
            { id: "docs", label: props.props.crumbDocuments, href: props.props.documentsHref },
            { id: "current", label: props.props.title },
        ]}
        eyebrow={props.props.eyebrow}
        title={props.props.title}
        description={props.props.description}
    />
)

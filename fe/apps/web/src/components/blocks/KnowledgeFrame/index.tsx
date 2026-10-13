import type { ReactNode } from "react"
import { PageContainer } from "@starci/grammar/common"
import { PageHeading } from "@/components/composites/PageHeading"
import { FRAME_CLASS_NAME } from "./classNames"

/** What the frame of a page under the documents draws. */
type KnowledgeFrameProps = {
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
    readonly children: ReactNode
}

/** The trail (home, Second Brain, documents, this page), the heading and the content of a page under the documents. */
export const KnowledgeFrame = (props: KnowledgeFrameProps) => (
    <PageContainer measure="product">
        <div className={FRAME_CLASS_NAME}>
            <PageHeading
                crumbLabel={props.crumbLabel}
                crumbs={[
                    { id: "home", label: props.crumbHome, href: props.homeHref },
                    { id: "brain", label: props.crumbBrain, href: props.brainHref },
                    { id: "docs", label: props.crumbDocuments, href: props.documentsHref },
                    { id: "current", label: props.title },
                ]}
                eyebrow={props.eyebrow}
                title={props.title}
                description={props.description}
            />
            {props.children}
        </div>
    </PageContainer>
)

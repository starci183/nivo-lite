import type { ReactNode } from "react"
import { PageContainer } from "@starci/grammar/common"
import { PageHeading } from "@/components/composites/PageHeading"
import { PAGE_CLASS_NAME } from "./classNames"

interface CreditsLayoutBaseProps {
    readonly children: ReactNode
    readonly props: {
        readonly title: string
        readonly description: string
        readonly history: string
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
    }
}

/** Draws the static credits frame around independently connected slots. */
export const CreditsLayoutBase = (props: CreditsLayoutBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <PageHeading
                crumbLabel={props.props.crumbLabel}
                crumbs={props.props.crumbs}
                title={props.props.title}
                description={props.props.description}
                actionLabel={props.props.history}
                actionHref="#payments"
            />
            {props.children}
        </div>
    </PageContainer>
)

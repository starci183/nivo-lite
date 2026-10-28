import { Alert, PageContainer, PageHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { PAGE } from "./classNames"

/** Copy, trail and the retry command supplied by the connected route error block. */
export interface RouteErrorBaseProps {
    readonly props: {
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly crumbLabel: string
        readonly title: string
        readonly alertTitle: string
        readonly message: string
        readonly retryLabel: string
    }
    readonly on: { readonly retry?: () => void }
}

/** Draws a failed route: the page's own trail and heading stay real, the body is one negative Alert with the safe retry. */
export const RouteErrorBase = (props: RouteErrorBaseProps) => (
    <>
        <PageHeader
            measure="product"
            breadcrumbs={{ label: props.props.crumbLabel, items: props.props.crumbs }}
            title={props.props.title}
        />
        <PageContainer measure="product">
            <div className={PAGE}>
                <Alert
                    tone="negative"
                    title={props.props.alertTitle}
                    description={props.props.message}
                    {...(props.on.retry ? { action: { label: props.props.retryLabel, onAction: props.on.retry } } : {})}
                />
            </div>
        </PageContainer>
    </>
)

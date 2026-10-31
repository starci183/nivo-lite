import { Alert, Page, Stack } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"

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
    <Page
        measure="product"
        header={{
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
            title: props.props.title,
        }}
    >
        <Stack gap="region">
            <Alert
                tone="negative"
                title={props.props.alertTitle}
                description={props.props.message}
                {...(props.on.retry ? { action: { label: props.props.retryLabel, onAction: props.on.retry } } : {})}
            />
        </Stack>
    </Page>
)

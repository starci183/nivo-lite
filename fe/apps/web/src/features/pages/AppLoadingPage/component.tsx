import { Page, Skeleton, SurfaceCard } from "@starci/grammar/common"

/** Props for the pure loading page. */
export type AppLoadingPageBaseProps = { readonly props: { readonly label: string } }

/** Draws a page-shaped skeleton: the header band as inert geometry, then one card. */
export const AppLoadingPageBase = (props: AppLoadingPageBaseProps) => (
    <Page measure="product" header={{ title: props.props.label }} isSkeleton>
        <SurfaceCard ariaLabel={props.props.label}>
            <Skeleton shape="text" lines={4} />
        </SurfaceCard>
    </Page>
)

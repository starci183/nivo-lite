import { Heading, PageContainer, Skeleton, SurfaceCard } from "@starci/grammar/common"

/** Props for the pure loading page. */
export type AppLoadingPageBaseProps = { readonly props: { readonly label: string } }

/** Draws a page-shaped skeleton: a heading and one card. */
export const AppLoadingPageBase = (props: AppLoadingPageBaseProps) => (
    <PageContainer measure="product">
        <Heading level={1} isSkeleton>
            {props.props.label}
        </Heading>
        <SurfaceCard ariaLabel={props.props.label}>
            <Skeleton shape="text" lines={4} />
        </SurfaceCard>
    </PageContainer>
)

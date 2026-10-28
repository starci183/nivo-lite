import { PageContainer, PageHeader, Skeleton, SurfaceCard } from "@starci/grammar/common"

/** The copy of the console loading skeleton. */
export interface ConsoleLoadingPageBaseProps {
    readonly props: { readonly crumbLabel: string; readonly crumbHome: string; readonly loading: string }
}

/** Draws a page-shaped skeleton: the header band as inert geometry, then one card. */
export const ConsoleLoadingPageBase = (props: ConsoleLoadingPageBaseProps) => (
    <>
        <PageHeader
            title={props.props.loading}
            breadcrumbs={{ label: props.props.crumbLabel, items: [{ id: "home", label: props.props.crumbHome }] }}
            isSkeleton
        />
        <PageContainer measure="product">
            <SurfaceCard ariaLabel={props.props.loading}>
                <Skeleton shape="text" lines={4} />
            </SurfaceCard>
        </PageContainer>
    </>
)

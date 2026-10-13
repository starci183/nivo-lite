import { Breadcrumbs, Heading, PageContainer, Skeleton, SurfaceCard } from "@starci/grammar/common"

/** The copy of the console loading skeleton. */
export interface ConsoleLoadingPageBaseProps {
    readonly props: { readonly crumbLabel: string; readonly crumbHome: string; readonly loading: string }
}

/** Draws a page-shaped skeleton: the shell trail, a heading and one card. */
export const ConsoleLoadingPageBase = (props: ConsoleLoadingPageBaseProps) => (
    <PageContainer measure="product">
        <Breadcrumbs label={props.props.crumbLabel} items={[{ id: "home", label: props.props.crumbHome }]} />
        <Heading level={1} isSkeleton>
            {props.props.loading}
        </Heading>
        <SurfaceCard ariaLabel={props.props.loading}>
            <Skeleton shape="text" lines={4} />
        </SurfaceCard>
    </PageContainer>
)

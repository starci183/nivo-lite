import { EmptyNotice, Page, SurfaceCard } from "@starci/grammar/common"

/** The copy of the console loading skeleton. */
export interface ConsoleLoadingPageBaseProps {
    readonly props: { readonly crumbLabel: string; readonly crumbHome: string; readonly loading: string }
}

/** Draws a page-shaped skeleton: the header band as inert geometry, then one card. */
export const ConsoleLoadingPageBase = (props: ConsoleLoadingPageBaseProps) => (
    <Page
        measure="product"
        isLoading
        header={{
            title: props.props.loading,
            breadcrumbs: { label: props.props.crumbLabel, items: [{ id: "home", label: props.props.crumbHome }] },
        }}
    >
        <SurfaceCard
            kind="list"
            ariaLabel={props.props.loading}
            isLoading
            items={[]}
            empty={<EmptyNotice message={props.props.loading} />}
        />
    </Page>
)

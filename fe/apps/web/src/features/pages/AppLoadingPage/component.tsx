import { EmptyNotice, Page, SurfaceCard } from "@starci/grammar/common"

/** Props for the pure loading page. */
export type AppLoadingPageBaseProps = { readonly props: { readonly label: string } }

/** Draws a page-shaped skeleton: the header band as inert geometry, then one list card drawn from its own structure. */
export const AppLoadingPageBase = (props: AppLoadingPageBaseProps) => (
    <Page measure="product" header={{ title: props.props.label }} isLoading>
        <SurfaceCard
            kind="list"
            ariaLabel={props.props.label}
            isLoading
            items={[]}
            empty={<EmptyNotice message={props.props.label} />}
        />
    </Page>
)

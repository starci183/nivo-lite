import { EmptyNotice, Page } from "@starci/grammar/common"

/** Props for {@link ConnectionRefusedPage}: what a member who may not read a provider page sees instead. */
type ConnectionRefusedPageProps = {
    readonly props: {
        readonly title: string
        readonly crumbLabel: string
        readonly homeLabel: string
        readonly homeHref: string
        readonly message: string
        readonly description: string
    }
}

/** The page a member who may not manage connections sees in place of a provider page: the trail home and one notice saying who can. */
export const ConnectionRefusedPage = (props: ConnectionRefusedPageProps) => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            breadcrumbs: {
                label: props.props.crumbLabel,
                items: [
                    { id: "home", label: props.props.homeLabel, href: props.props.homeHref },
                    { id: "connections", label: props.props.title },
                ],
            },
        }}
    >
        <EmptyNotice message={props.props.message} description={props.props.description} />
    </Page>
)

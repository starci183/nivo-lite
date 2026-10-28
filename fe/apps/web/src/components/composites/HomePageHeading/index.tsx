import { PageHeader } from "@starci/grammar/common"
import { APP_ROUTES } from "@/modules/routes"

/** What the heading of a console page one level under the dashboard draws. */
type HomePageHeadingProps = {
    /** The accessible name of the trail. */
    readonly crumbLabel: string
    /** The first crumb: the dashboard. */
    readonly crumbHome: string
    readonly eyebrow: string
    readonly title: string
    readonly description: string
}

/** The page header band (dashboard, then this page) of a console page. Place it outside the page PageContainer. */
export const HomePageHeading = (props: HomePageHeadingProps) => (
    <PageHeader
        title={props.title}
        description={props.description}
        meta={props.eyebrow}
        breadcrumbs={{
            label: props.crumbLabel,
            items: [
                { id: "home", label: props.crumbHome, href: APP_ROUTES.dashboard },
                { id: "current", label: props.title },
            ],
        }}
    />
)

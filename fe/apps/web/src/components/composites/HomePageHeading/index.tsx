import { Breadcrumbs, SectionHeader } from "@starci/grammar/common"
import { APP_ROUTES } from "@/modules/routes"
import { HEAD_CLASS_NAME } from "./classNames"

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

/** The trail (dashboard, then this page) over the level-1 heading of a console page. */
export const HomePageHeading = (props: HomePageHeadingProps) => (
    <div className={HEAD_CLASS_NAME}>
        <Breadcrumbs
            label={props.crumbLabel}
            items={[
                { id: "home", label: props.crumbHome, href: APP_ROUTES.dashboard },
                { id: "current", label: props.title },
            ]}
        />
        <SectionHeader level={1} eyebrow={props.eyebrow} title={props.title} description={props.description} />
    </div>
)

import { Breadcrumbs, Button, SectionHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { HEAD_CLASS_NAME } from "./classNames"

/** What the heading block of a console page draws. */
type PageHeadingProps = {
    /** The accessible name of the trail. */
    readonly crumbLabel: string
    /** The trail, the current page last. */
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly eyebrow?: string
    readonly actionLabel?: string
    readonly actionHref?: string
    readonly title: string
    readonly description: string
}

/** The trail over the level-1 heading of a console page, as one heading block. */
export const PageHeading = (props: PageHeadingProps) => (
    <div className={HEAD_CLASS_NAME}>
        <Breadcrumbs label={props.crumbLabel} items={props.crumbs} />
        <SectionHeader
            level={1}
            eyebrow={props.eyebrow}
            title={props.title}
            description={props.description}
            action={
                props.actionLabel ? (
                    <Button variant="secondary" {...(props.actionHref !== undefined && { href: props.actionHref })}>
                        {props.actionLabel}
                    </Button>
                ) : undefined
            }
        />
    </div>
)

import type { ReactNode } from "react"
import { Button, PageHeader } from "@starci/grammar/common"
import type { BreadcrumbItem, PageHeaderProps } from "@starci/grammar/common"

/** What the heading band of a console page draws. */
type PageHeadingProps = {
    /** The accessible name of the trail. */
    readonly crumbLabel: string
    /** The trail, the current page last. */
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    /** The short line above the facts of the page; it takes the summary slot when `meta` is absent. */
    readonly eyebrow?: string
    readonly actionLabel?: string
    readonly actionHref?: string
    readonly title: string
    readonly description: string
    /** The summary line of facts about the page subject. */
    readonly meta?: ReactNode
    readonly status?: ReactNode
    readonly mark?: ReactNode
    /** Extra commands after the single action. */
    readonly actions?: ReactNode
    readonly tabs?: PageHeaderProps["tabs"]
    readonly measure?: PageHeaderProps["measure"]
    readonly isSkeleton?: boolean
}

/** The page header band of a console page: trail, level-1 heading and commands. Place it outside the page PageContainer. */
export const PageHeading = (props: PageHeadingProps) => {
    const meta = props.meta ?? props.eyebrow
    const action =
        props.actionLabel === undefined || props.actionLabel === "" ? undefined : (
            <Button intent="alternative" {...(props.actionHref !== undefined && { href: props.actionHref })}>
                {props.actionLabel}
            </Button>
        )
    const actions =
        action === undefined && props.actions === undefined ? undefined : (
            <>
                {action}
                {props.actions}
            </>
        )
    return (
        <PageHeader
            title={props.title}
            description={props.description}
            breadcrumbs={{ label: props.crumbLabel, items: props.crumbs }}
            {...(meta !== undefined && { meta })}
            {...(props.status !== undefined && { status: props.status })}
            {...(props.mark !== undefined && { mark: props.mark })}
            {...(actions !== undefined && { actions })}
            {...(props.tabs !== undefined && { tabs: props.tabs })}
            {...(props.measure !== undefined && { measure: props.measure })}
            {...(props.isSkeleton !== undefined && { isSkeleton: props.isSkeleton })}
        />
    )
}

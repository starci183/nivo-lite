import { Link, PageHeader } from "@starci/grammar/common"

/** Props for {@link AutomationsHeadingBase}. */
export interface AutomationsHeadingBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        /** The workspace name under the title; unknown while the page loads. */
        readonly workspace?: string
        readonly title: string
        readonly leadBefore: string
        readonly leadLink: string
        readonly leadHref: string
        readonly leadAfter: string
        /** True while the workspace name is unresolved: the meta line is drawn as its measured placeholder. */
        readonly isSkeleton: boolean
    }
}

/** The page header of Automations, with the link to the authority page inside the lead. */
export const AutomationsHeadingBase = (props: AutomationsHeadingBaseProps) => {
    const p = props.props
    return (
        <PageHeader
            measure="product"
            isSkeleton={p.isSkeleton}
            breadcrumbs={{ label: p.crumbLabel, items: p.crumbs }}
            title={p.title}
            meta={p.workspace ?? "-"}
            description={
                <>
                    {p.leadBefore}
                    <Link href={p.leadHref}>{p.leadLink}</Link>
                    {p.leadAfter}
                </>
            }
        />
    )
}

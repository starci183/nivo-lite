import { Breadcrumbs, Link, SectionHeader } from "@starci/grammar/common"
import { HEAD_CLASS } from "./classNames"

/** Props for {@link AutomationsHeadingBase}. */
export interface AutomationsHeadingBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        /** The workspace name above the title; unknown while the page loads. */
        readonly eyebrow?: string
        readonly title: string
        readonly leadBefore: string
        readonly leadLink: string
        readonly leadHref: string
        readonly leadAfter: string
    }
}

/** The trail and the heading, with the link to the authority page inside the lead. */
export const AutomationsHeadingBase = (props: AutomationsHeadingBaseProps) => {
    const p = props.props
    return (
        <div className={HEAD_CLASS}>
            <Breadcrumbs label={p.crumbLabel} items={p.crumbs} />
            <SectionHeader
                level={1}
                eyebrow={p.eyebrow}
                title={p.title}
                description={
                    <>
                        {p.leadBefore}
                        <Link href={p.leadHref}>{p.leadLink}</Link>
                        {p.leadAfter}
                    </>
                }
            />
        </div>
    )
}

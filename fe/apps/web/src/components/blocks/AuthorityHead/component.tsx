import { Alert, Breadcrumbs, SectionHeader, Text } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { HEAD_CLASS, TITLE_CLASS } from "./classNames"

/** Copy and state of the authority heading. */
export interface AuthorityHeadBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly motto: string
        readonly readOnlyTitle: string
        readonly readOnlyBody: string
        /** Staff see the authority but cannot change it (the server refuses too). */
        readonly isReadOnly: boolean
    }
}

/** Draws the authority heading: trail, title, the motto and, for staff, the view-only note. */
export const AuthorityHeadBase = (props: AuthorityHeadBaseProps) => {
    const view = props.props
    return (
        <div className={HEAD_CLASS}>
            <div className={TITLE_CLASS}>
                <Breadcrumbs label={view.crumbLabel} items={view.crumbs} />
                <SectionHeader level={1} eyebrow={view.eyebrow} title={view.title} description={view.description} />
            </div>
            <Text weight="medium">{view.motto}</Text>
            {view.isReadOnly ? (
                <Alert tone="cautionary" title={view.readOnlyTitle} description={view.readOnlyBody} />
            ) : null}
        </div>
    )
}

import { Alert, PageContainer, PageHeader, Text } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { HEAD_CLASS } from "./classNames"

/** Copy and state of the authority heading. */
export interface AuthorityHeadBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
        readonly motto: string
        readonly readOnlyTitle: string
        readonly readOnlyBody: string
        /** Staff see the authority but cannot change it (the server refuses too). */
        readonly isReadOnly: boolean
    }
}

/** Draws the authority heading: the page header, then the motto and, for staff, the view-only note. */
export const AuthorityHeadBase = (props: AuthorityHeadBaseProps) => {
    const view = props.props
    return (
        <>
            <PageHeader
                measure="product"
                breadcrumbs={{ label: view.crumbLabel, items: view.crumbs }}
                title={view.title}
                description={view.description}
            />
            <PageContainer measure="product" className={HEAD_CLASS}>
                <Text weight="medium">{view.motto}</Text>
                {view.isReadOnly ? (
                    <Alert tone="cautionary" title={view.readOnlyTitle} description={view.readOnlyBody} />
                ) : null}
            </PageContainer>
        </>
    )
}

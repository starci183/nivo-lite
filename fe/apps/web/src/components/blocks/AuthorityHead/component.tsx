import { Alert, Page, Stack, Text } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** Copy and state of the authority page frame, and the sections it frames. */
export interface AuthorityHeadBaseProps {
    /** The sections of the page, drawn under the motto. */
    readonly shape: { readonly body: ReactNode }
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

/** Draws the authority page: its header band, then in the body the motto, for staff the view-only note, and the sections. */
export const AuthorityHeadBase = (props: AuthorityHeadBaseProps) => {
    const view = props.props
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: { label: view.crumbLabel, items: view.crumbs },
                title: view.title,
                description: view.description,
            }}
        >
            <Stack gap="region">
                <Text weight="medium">{view.motto}</Text>
                {view.isReadOnly ? (
                    <Alert tone="cautionary" title={view.readOnlyTitle} description={view.readOnlyBody} />
                ) : null}
                {props.shape.body}
            </Stack>
        </Page>
    )
}

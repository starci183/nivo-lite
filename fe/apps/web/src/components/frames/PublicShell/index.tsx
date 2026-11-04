import type { ReactNode } from "react"
import { Page, Stack, Text, TopBar, WorkspaceShell } from "@starci/grammar/common"
import { FOOT_CLASS_NAME } from "./classNames"

/** The words and slots of a page a visitor opens without signing in. */
interface PublicShellProps {
    /** The name of the page's main region. */
    readonly label: string
    /** The business mark and name that start the bar. */
    readonly brand: ReactNode
    /** The controls at the end of the bar: the language menu. */
    readonly actions: ReactNode
    /** The foot line under the page. */
    readonly foot: string
    /** The page measure: `reading` for one narrow card, `product` for a page with two columns. */
    readonly measure: "reading" | "product"
    readonly children: ReactNode
}

/** The frame of every public page: a bar with the business, the page on the canvas, the foot line under it. */
export const PublicShell = (props: PublicShellProps) => (
    <WorkspaceShell
        viewport="flow"
        align="stretch"
        header={<TopBar brand={props.brand} actions={props.actions} />}
        primaryLabel={props.label}
        primary={
            <Page measure={props.measure}>
                <Stack gap="region">
                    {props.children}
                    <div className={FOOT_CLASS_NAME}>
                        <Text size="xs" tone="muted">
                            {props.foot}
                        </Text>
                    </div>
                </Stack>
            </Page>
        }
    />
)

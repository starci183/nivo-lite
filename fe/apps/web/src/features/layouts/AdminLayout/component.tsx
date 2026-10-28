import { Page, SectionHeader } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AdminAccount } from "@/components/blocks/AdminAccount"
import { AdminNavigation } from "@/components/blocks/AdminNavigation"

/** The words and the signed-in admin the console frame draws. */
export interface AdminLayoutBaseProps {
    readonly props: {
        readonly title: string
    }
    readonly children: ReactNode
}

/** Draws the team console frame: the bar with brand, destinations and who is signed in, then the routed page, which draws its own `Page`. */
export const AdminLayoutBase = (props: AdminLayoutBaseProps) => (
    <>
        <Page measure="full">
            <SectionHeader
                title={props.props.title}
                action={
                    <>
                        <AdminNavigation />
                        <AdminAccount />
                    </>
                }
            />
        </Page>
        {props.children}
    </>
)

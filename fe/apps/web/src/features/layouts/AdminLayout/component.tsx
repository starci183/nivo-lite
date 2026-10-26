import { PageContainer, SectionHeader } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AdminAccount } from "@/components/blocks/AdminAccount"
import { AdminNavigation } from "@/components/blocks/AdminNavigation"
import { PAGE_CLASS_NAME } from "./classNames"

/** The words and the signed-in admin the console frame draws. */
export interface AdminLayoutBaseProps {
    readonly props: {
        readonly title: string
    }
    readonly children: ReactNode
}

/** Draws the team console frame: the header with brand, destinations and who is signed in, then the routed page. */
export const AdminLayoutBase = (props: AdminLayoutBaseProps) => (
    <PageContainer measure="full">
        <div className={PAGE_CLASS_NAME}>
            <SectionHeader
                title={props.props.title}
                action={
                    <>
                        <AdminNavigation />
                        <AdminAccount />
                    </>
                }
            />
            {props.children}
        </div>
    </PageContainer>
)

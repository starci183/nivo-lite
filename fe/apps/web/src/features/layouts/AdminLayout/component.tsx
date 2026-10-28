import { SectionHeader } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AdminAccount } from "@/components/blocks/AdminAccount"
import { AdminNavigation } from "@/components/blocks/AdminNavigation"
import { BAR_CLASS_NAME } from "./classNames"

/** The words and the signed-in admin the console frame draws. */
export interface AdminLayoutBaseProps {
    readonly props: {
        readonly title: string
    }
    readonly children: ReactNode
}

/** Draws the team console frame: the bar with brand, destinations and who is signed in, placed as plain layout above the routed page, which draws its own one `Page`. */
export const AdminLayoutBase = (props: AdminLayoutBaseProps) => (
    <>
        <div className={BAR_CLASS_NAME}>
            <SectionHeader
                title={props.props.title}
                action={
                    <>
                        <AdminNavigation />
                        <AdminAccount />
                    </>
                }
            />
        </div>
        {props.children}
    </>
)

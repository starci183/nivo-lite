import { WorkspaceShell } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AdminHeader } from "@/components/blocks/AdminHeader"

/** The words the console frame draws. */
export interface AdminLayoutBaseProps {
    readonly props: {
        readonly title: string
    }
    readonly children: ReactNode
}

/** Draws the team console frame: the connected bar with title, destinations, language, appearance and the signed-in admin, placed as plain layout above the routed page, which draws its own one `Page`. */
export const AdminLayoutBase = (props: AdminLayoutBaseProps) => (
    <WorkspaceShell
        viewport="fixed"
        primaryLabel={props.props.title}
        header={<AdminHeader />}
        primary={props.children}
    />
)

import { Text, TopBar, WorkspaceShell } from "@starci/grammar/common"
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

/** Draws the team console frame: the bar with brand, destinations and who is signed in, placed as plain layout above the routed page, which draws its own one `Page`. */
export const AdminLayoutBase = (props: AdminLayoutBaseProps) => (
    <WorkspaceShell
        viewport="fixed"
        primaryLabel={props.props.title}
        header={
            <TopBar
                brand={<Text isStrong>{props.props.title}</Text>}
                actions={<AdminAccount />}
                subnavigation={<AdminNavigation />}
                subnavigationLabel={props.props.title}
            />
        }
        primary={props.children}
    />
)

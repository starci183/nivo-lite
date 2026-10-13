import { Button, NavLandmark } from "@starci/grammar/common"

/** One destination of the console bar. */
export interface AdminNavigationItem {
    readonly id: string
    readonly label: string
    readonly href: string
    readonly isCurrent: boolean
}

/** Copy and destinations the connected console navigation supplies. */
export interface AdminNavigationBaseProps {
    readonly props: {
        readonly label: string
        readonly items: ReadonlyArray<AdminNavigationItem>
    }
}

/** Draws the console destinations as a bar of buttons, the current one raised. */
export const AdminNavigationBase = (props: AdminNavigationBaseProps) => (
    <NavLandmark label={props.props.label} layout="bar">
        {props.props.items.map((item) => (
            <Button key={item.id} size="sm" variant={item.isCurrent ? "secondary" : "ghost"} href={item.href}>
                {item.label}
            </Button>
        ))}
    </NavLandmark>
)

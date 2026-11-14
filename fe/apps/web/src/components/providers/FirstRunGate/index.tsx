"use client"

import { useEffect, type ReactNode } from "react"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, AUTH_ROUTES } from "@/modules/routes"

/** The steps of the first run that follow the one making the workspace. */
interface FirstRunGateProps {
    readonly children: ReactNode
}

/** What the gate draws: the step when it has its workspace, nothing while the person is sent back to the lobby. */
interface FirstRunGateBaseProps {
    readonly isOpen: boolean
    readonly content: ReactNode
}

/** Lets the step through, or draws nothing (no flash of an error page) while the redirect runs. */
const FirstRunGateBase = (props: FirstRunGateBaseProps): ReactNode => (props.isOpen ? props.content : null)

/** The first step makes the workspace and carries no `ws`; every later step needs it: an address without one goes to the lobby instead of throwing. */
export const FirstRunGate = (props: FirstRunGateProps) => {
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const workspaceId = useOpenWorkspaceId()
    const isFirstStep = pathname === APP_ROUTES.workspaceNew || pathname === `${APP_ROUTES.workspaceNew}/`
    const isOpen = isFirstStep || workspaceId !== undefined
    useEffect(() => {
        if (!isOpen) router.replace(AUTH_ROUTES.workspaces)
    }, [isOpen, router])
    return <FirstRunGateBase isOpen={isOpen} content={props.children} />
}

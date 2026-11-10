"use client"

import { useTranslations } from "next-intl"
import type { PageHeaderBreadcrumbs } from "@starci/grammar/common"
import { useWorkspaceId } from "@/hooks/workspaces"
import { consoleBreadcrumbsOf } from "@/modules/page-header"

/** One ancestor of the page between the dashboard and the page itself. */
interface CrumbStep {
    readonly id: string
    readonly label: string
    /** The route of the ancestor inside the workspace. */
    readonly path: string
}

/** The trail of a console page for a connected block: the dashboard, the ancestors and the page itself. */
export const useConsoleCrumbs = (current: string, trail?: ReadonlyArray<CrumbStep>): PageHeaderBreadcrumbs => {
    const shell = useTranslations("shell")
    const workspaceId = useWorkspaceId()
    return consoleBreadcrumbsOf({
        workspaceId,
        label: shell("crumbLabel"),
        home: shell("crumbHome"),
        current,
        ...(trail === undefined ? {} : { trail }),
    })
}

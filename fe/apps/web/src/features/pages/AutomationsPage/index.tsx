import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AutomationsBoard } from "@/components/blocks/AutomationsBoard"
import { AutomationsHeading } from "@/components/blocks/AutomationsHeading"
import { AutomationsForbidden } from "@/components/composites/AutomationsForbidden"
import { AutomationsPageLayout } from "@/components/composites/AutomationsPageLayout"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"
import { readAutomations } from "@/modules/db"
import { AUTOMATION_ROUTES, CONSOLE_ROUTES } from "@/modules/routes"

/** The document title of the page. */
export const automationsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("automations")
    return { title: t("title") }
}

/** Props for the automations page. */
interface AutomationsPageProps {
    /** `?focus=<key>` opens that card. */
    readonly focus?: string
}

/** The Automations page: ready-made jobs the owner switches on. Owner and manager only; staff see a friendly 403. */
export const AutomationsPage = async (props: AutomationsPageProps) => {
    const t = await getTranslations("automations")
    const session = await getSession()
    if (!isManagerRole(session.member.role)) {
        return (
            <AutomationsForbidden
                title={t("forbiddenTitle")}
                body={t("forbiddenBody")}
                backLabel={t("forbiddenBack")}
                backHref={CONSOLE_ROUTES.chat}
            />
        )
    }
    const outcome = await readAutomations(session.workspace.id)
    if (outcome.kind !== "ok") throw new Error(`automations: ${outcome.kind} ${outcome.code}`)
    return (
        <AutomationsPageLayout
            heading={<AutomationsHeading workspaceName={session.workspace.name} />}
            board={
                <AutomationsBoard
                    workspaceId={session.workspace.id}
                    initial={outcome.value}
                    layout="page"
                    {...(props.focus === undefined ? {} : { focus: props.focus })}
                />
            }
            advancedLabel={t("advanced")}
            advancedHref={AUTOMATION_ROUTES.developers}
        />
    )
}

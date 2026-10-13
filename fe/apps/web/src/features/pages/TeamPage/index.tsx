import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { teamViews } from "@/hooks/team"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"
import { readTeamRoster, readTeamStaff } from "@/modules/db"
import { APP_ROUTES } from "@/modules/routes"
import { TeamPageBase } from "./component"
import type { TeamPageBaseProps } from "./component"

/** The document title of the page. */
export const teamMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("team")
    return { title: t("title") }
}

type Translate = Awaited<ReturnType<typeof getTranslations<"team">>>

/** The words of the page that do not depend on its data. */
const copyOf = (
    t: Translate,
): Pick<TeamPageBaseProps["props"], "crumbLabel" | "crumbHome" | "homeHref" | "eyebrow" | "title" | "description"> => ({
    crumbLabel: t("crumbLabel"),
    crumbHome: t("crumbHome"),
    homeHref: APP_ROUTES.dashboard,
    eyebrow: t("eyebrow"),
    title: t("title"),
    description: t("description"),
})

/** The /team screen body (owner and manager): reads the roster from the back end api and the staff rows under RLS. Staff see a friendly 403. */
export const TeamPage = async () => {
    const t = await getTranslations("team")
    const session = await getSession()
    const empty = {
        workspaceId: session.workspace.id,
        selfId: session.userId,
        selfRole: session.member.role,
        members: [],
        invites: [],
        staffChoices: [],
        isLoading: false,
    }
    if (!isManagerRole(session.member.role)) {
        return (
            <TeamPageBase
                props={{
                    ...copyOf(t),
                    ...empty,
                    forbidden: {
                        eyebrow: t("eyebrow"),
                        title: t("forbiddenTitle"),
                        body: t("forbiddenBody"),
                        backLabel: t("forbiddenBack"),
                        backHref: APP_ROUTES.chat,
                    },
                }}
            />
        )
    }
    const [roster, staff] = await Promise.all([
        readTeamRoster(session.workspace.id),
        readTeamStaff(session.workspace.id),
    ])
    if (roster.kind !== "ok") throw new Error(`team: ${roster.kind} ${roster.code}`)
    if (staff.kind !== "ok") throw new Error(`team: ${staff.kind} ${staff.code}`)
    const views = teamViews(roster.value, staff.value)
    return <TeamPageBase props={{ ...copyOf(t), ...empty, ...views }} />
}

/** The same page while its data loads: headings and labels stay, members and invitations are skeleton rows. */
export const TeamLoadingPage = async () => {
    const t = await getTranslations("team")
    return (
        <TeamPageBase
            props={{
                ...copyOf(t),
                workspaceId: "",
                selfId: "",
                selfRole: "staff",
                members: [],
                invites: [],
                staffChoices: [],
                isLoading: true,
            }}
        />
    )
}

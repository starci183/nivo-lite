"use client"

import { useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { authoritySectionPath, workspaceHref } from "@/modules/routes"
import { AuthoritySectionsBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the page tells the list: the section the address names. */
interface AuthoritySectionsProps {
    /** The ids of the sections, in the order of the operating flow. */
    readonly sections: ReadonlyArray<string>
    readonly selected: string | null
}

/** The list of the five sections: choosing a row goes to that section's address. */
export const AuthoritySections = (props: AuthoritySectionsProps) => {
    const t = useTranslations("authority")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    return (
        <AuthoritySectionsBase
            props={{
                label: t("listLabel"),
                rows: props.sections.map((id) => ({ id, title: t(`${id}Title`), description: t(`${id}Line`) })),
                selectedId: props.selected,
            }}
            on={{ select: (id) => router.push(workspaceHref(workspaceId, authoritySectionPath(id))) }}
        />
    )
}

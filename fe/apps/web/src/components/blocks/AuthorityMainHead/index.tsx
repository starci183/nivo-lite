"use client"

import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { AuthorityMainHeadBase } from "./component"

/** What the page tells the head: the open section, or none on the phone's list. */
interface AuthorityMainHeadProps {
    readonly section: string
}

/** The head of the main pane: the open section's name; going back opens the list. */
export const AuthorityMainHead = (props: AuthorityMainHeadProps) => {
    const t = useTranslations("authority")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    return (
        <AuthorityMainHeadBase
            props={{ title: t(`${props.section}Title`), back: pane.backToList }}
            on={{ back: () => router.push(CONSOLE_ROUTES.authority) }}
        />
    )
}

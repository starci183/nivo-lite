"use client"

import { navigation } from "@/modules/i18n"
import { AppNotFoundBase } from "./component"

/** The words of the unknown-route page and where its one action leads. */
interface AppNotFoundProps {
    readonly title: string
    readonly text: string
    readonly homeLabel: string
    readonly homeHref: string
}

/** The unknown-route page: the way home goes through the locale-aware router. */
export const AppNotFound = (props: AppNotFoundProps) => {
    const router = navigation.useRouter()
    return (
        <AppNotFoundBase
            props={{ grid: props.title, title: props.title, text: props.text, homeLabel: props.homeLabel }}
            on={{ goHome: () => router.push(props.homeHref) }}
        />
    )
}

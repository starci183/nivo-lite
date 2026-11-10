"use client"

import { consoleUrl } from "@/modules/config"
import { AppNotFoundBase } from "./component"

/** The words of the not-found page. */
interface AppNotFoundProps {
    readonly title: string
    readonly text: string
    readonly homeLabel: string
}

/** The unknown-route page: its one way out leaves for the customer console. */
export const AppNotFound = (props: AppNotFoundProps) => (
    <AppNotFoundBase
        props={{ title: props.title, text: props.text, homeLabel: props.homeLabel }}
        on={{ goHome: () => window.location.assign(consoleUrl()) }}
    />
)

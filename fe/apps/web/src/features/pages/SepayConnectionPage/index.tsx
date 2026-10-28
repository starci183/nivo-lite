import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { SepayConnectionPageBase } from "./component"

/** The document title of the SePay connection page. */
export const sepayConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("sepayConnection")
    return { title: t("title") }
}

/** What the route hands the page: the connection id and the `?tab=` of the url. */
type SepayConnectionPageProps = {
    readonly connectionId: string
    readonly tab: string | ReadonlyArray<string> | undefined
}

/** /connections/sepay/[id]: a server shell; the regions read their own data in the browser. */
export const SepayConnectionPage = (props: SepayConnectionPageProps) => (
    <SepayConnectionPageBase
        props={{
            connectionId: props.connectionId,
            tab: typeof props.tab === "string" ? props.tab : undefined,
            homeHref: CONSOLE_ROUTES.dashboard,
            hubHref: CONSOLE_ROUTES.connections,
        }}
    />
)

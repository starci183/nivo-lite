import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { SepayConnectionPageBase } from "./component"

/** The document title of the SePay connection page. */
export const sepayConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("sepayConnection")
    return { title: t("title") }
}

/** What the route hands the page: the connection id. */
type SepayConnectionPageProps = {
    readonly connectionId: string
}

/** /connections/sepay/[id]: a server shell; the bands read their own data in the browser. */
export const SepayConnectionPage = (props: SepayConnectionPageProps) => (
    <SepayConnectionPageBase
        props={{
            connectionId: props.connectionId,
            homeHref: CONSOLE_ROUTES.dashboard,
            hubHref: CONSOLE_ROUTES.connections,
        }}
    />
)

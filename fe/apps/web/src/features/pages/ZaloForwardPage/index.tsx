import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ZaloForwardPageBase } from "./component"

/** The document title of the page, which only forwards. */
export const zaloForwardMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("connections")
    return { title: t("zaloReturnTitle") }
}

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
interface ZaloForwardPageProps {
    readonly code: string | undefined
    readonly oaId: string | undefined
    readonly state: string | undefined
}

/** Where Zalo sends the browser: the page names no workspace, so the connected block forwards the return into the one that started it. */
export const ZaloForwardPage = async (props: ZaloForwardPageProps): Promise<ReactElement> => {
    const t = await getTranslations("connections")
    return (
        <ZaloForwardPageBase
            props={{ title: t("zaloReturnTitle"), code: props.code, oaId: props.oaId, state: props.state }}
        />
    )
}

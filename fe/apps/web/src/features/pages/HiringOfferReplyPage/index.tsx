import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HiringOfferReplyPageBase } from "./component"

/** What the route passes through: the offer token in the candidate's link. */
interface HiringOfferReplyPageProps {
    readonly params: Promise<{ readonly token: string }>
}

/** The document title of the page; the link is private, so search engines are told to skip it. */
export const hiringOfferReplyMetadata = async (): Promise<Metadata> => ({
    title: (await getTranslations("hiring"))("replyOfferTitle"),
    robots: { index: false, follow: false },
})

/** The candidate's own link: read the offer and accept or decline it. The token in the link is the secret. */
export const HiringOfferReplyPage = async (props: HiringOfferReplyPageProps): Promise<ReactElement> => {
    const { token } = await props.params
    return <HiringOfferReplyPageBase props={{ token }} />
}

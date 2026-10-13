import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HiringInterviewReplyPageBase } from "./component"

/** What the route passes through: the interview token in the candidate's link. */
interface HiringInterviewReplyPageProps {
    readonly params: Promise<{ readonly token: string }>
}

/** The document title of the page; the link is private, so search engines are told to skip it. */
export const hiringInterviewReplyMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("hiring")
    return { title: t("replyInterviewTitle"), robots: { index: false, follow: false } }
}

/** The candidate's own link: choose one of the proposed interview times. The token in the link is the secret. */
export const HiringInterviewReplyPage = async (props: HiringInterviewReplyPageProps) => {
    const { token } = await props.params
    const t = await getTranslations("hiring")
    return <HiringInterviewReplyPageBase props={{ token, label: t("replyInterviewTitle"), foot: t("replyFoot") }} />
}

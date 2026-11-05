import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { InviteOverview } from "@/components/blocks/InviteOverview"

/** What the route passes through: the invitation token in the URL. */
interface InvitePageProps {
    readonly params: Promise<{ readonly token: string }>
}

/** The document title of the page. */
export const inviteMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("invite")
    return { title: t("eyebrow") }
}

/**
 * A public invitation page in the auth frame, the card beside the brand pitch like sign-in. The invitation is read in the browser from
 * the anonymous-callable `invitePreview` query, which also decides the right next step for a signed-out visitor, one signed in with
 * another e-mail, and the invited person.
 */
export const InvitePage = async (props: InvitePageProps): Promise<ReactElement> => {
    const { token } = await props.params
    return <InviteOverview token={token} />
}

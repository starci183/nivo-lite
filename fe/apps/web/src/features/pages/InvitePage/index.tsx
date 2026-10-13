import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { InvitePageBase } from "./component"

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
 * A public invitation page. The invitation is read in the browser from the anonymous-callable `invitePreview` query, which also
 * decides the right next step for a signed-out visitor, one signed in with another e-mail, and the invited person.
 */
export const InvitePage = async (props: InvitePageProps) => {
    const { token } = await props.params
    const t = await getTranslations("invite")
    return <InvitePageBase props={{ token, label: t("eyebrow") }} />
}

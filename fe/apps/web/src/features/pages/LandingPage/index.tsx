import { getTranslations } from "next-intl/server"
import { readSession } from "@/modules/db"
import { LandingPageBase } from "./component"

/** The public landing page; the reader's sign-in state decides the bar's account action. */
export const LandingPage = async () => {
    const [t, session] = await Promise.all([getTranslations("landing"), readSession()])
    return <LandingPageBase props={{ isSignedIn: session.kind === "ok", mainLabel: t("homeLabel") }} />
}

import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { readRequestOrigin } from "@/modules/db"
import { safeNextPath } from "@/modules/routes"
import { LoginPageBase } from "./component"

/** What the route passes through: the query of the sign-in URL. */
interface LoginPageProps {
    readonly searchParams: Promise<{ readonly error?: string; readonly notice?: string; readonly next?: string }>
}

/** The document title of the page. */
export const loginMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("login")
    return { title: t("signInTitle") }
}

/** Public sign-in page: reads the safe destination, the failure code of a finished /auth route and the success note. */
export const LoginPage = async (props: LoginPageProps) => {
    const { error, notice, next } = await props.searchParams
    const origin = await readRequestOrigin()
    const safe = next === undefined || origin === undefined ? "/" : safeNextPath(next, origin)
    return <LoginPageBase props={{ next: safe === "/" ? undefined : safe, errorCode: error, notice }} />
}

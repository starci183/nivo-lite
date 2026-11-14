import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { SandboxPanes } from "@/components/blocks/SandboxPanes"

/** The document title of the sandbox page. */
export const sandboxMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("sandbox")
    return { title: t("title") }
}

/** The sandbox route: trial accounts of the dev environment, their cases, call log and key, and the runs parked at a wait. Owner and manager only; production says there is none. */
export const SandboxPage = () => <SandboxPanes />

/** The same page while the route loads: the header stays real text, every block draws its own skeleton. */
export const SandboxLoadingPage = () => <SandboxPanes />

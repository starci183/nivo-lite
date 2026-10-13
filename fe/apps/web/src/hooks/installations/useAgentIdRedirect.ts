import { useEffect } from "react"
import { navigation } from "@/modules/i18n"
import { agentHref } from "@/modules/installations"
import { AGENTS_ROUTE } from "@/modules/routes"
import { useInstallations } from "./useInstallations"

/** Sends the old setup url of one agent (/modules/<agentId>) to the instance that owns the agent, else to the catalogue. */
export const useAgentIdRedirect = (agentId: string): void => {
    const router = navigation.useRouter()
    const { installations } = useInstallations()
    const owner = installations?.find((installation) => installation.agentId === agentId)
    const target = owner === undefined ? AGENTS_ROUTE : agentHref(owner.moduleKey, owner.id)
    const ready = installations !== undefined
    useEffect(() => {
        if (ready) router.replace(target)
    }, [ready, target, router])
}

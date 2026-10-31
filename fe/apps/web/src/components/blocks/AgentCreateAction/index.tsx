"use client"

import { useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { AGENT_ROLES_HREF } from "@/modules/routes"
import { AgentCreateActionBase } from "./component"

/** The connected create action of the catalogue header: shown to the people who may install agents, as the install buttons are. */
export const AgentCreateAction = () => {
    const t = useTranslations("modulesCore")
    const member = useMember()
    return (
        <AgentCreateActionBase
            props={{ label: t("createAgent"), href: AGENT_ROLES_HREF, canCreate: isManager(member) }}
        />
    )
}

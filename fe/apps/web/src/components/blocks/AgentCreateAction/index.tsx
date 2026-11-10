"use client"

import { useTranslations } from "next-intl"
import { useOpenAgentCreate } from "@/hooks/agentCreate"
import { isManager, useMember } from "@/hooks/member"
import { AgentCreateActionBase } from "./component"

/** The connected create action of the catalogue header: opens the create dialog, for the people who may install agents. */
export const AgentCreateAction = () => {
    const t = useTranslations("agentCatalog")
    const member = useMember()
    const openCreate = useOpenAgentCreate()
    return (
        <AgentCreateActionBase
            props={{
                label: t("create"),
                canCreate: isManager(member),
            }}
            on={{ create: () => openCreate() }}
        />
    )
}

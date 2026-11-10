"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { useCatalogEntries, useInstallations, type CatalogRole } from "@/hooks/installations"
import { useMember } from "@/hooks/member"
import { useQueryAgentChannelChoicesSwr } from "@/hooks/swr"
import { suggestedHandleOf } from "@/modules/agentAvatar"
import { isModuleKey, type ModuleKey } from "@/modules/catalog"
import { instancesOf, type Installation } from "@/modules/installations"
import { CREATE_AGENT_PARAM, roleOfParam, startValueOf } from "./agentCreate.shared"

/** The channels the back end lists for a role, as the read answers them. */
type ChannelRead = ReturnType<typeof useQueryAgentChannelChoicesSwr>

/** The fields of the create dialog, before the picture: the role, the name, the handle, the channels and the start. */
export interface AgentCreateForm {
    readonly isOpen: boolean
    readonly isRoleOpen: boolean
    readonly roles: ReadonlyArray<CatalogRole>
    readonly role: ModuleKey | null
    readonly setRole: (value: string | null) => void
    readonly name: string
    readonly setName: (value: string) => void
    readonly handle: string
    /** The handle the owner typed; null while it follows the name. */
    readonly typedHandle: string | null
    readonly setHandle: (value: string) => void
    readonly channels: ChannelRead
    readonly chosenChannels: ReadonlyArray<string>
    readonly setChosenChannels: (ids: ReadonlyArray<string>) => void
    readonly canGrantChannels: boolean
    readonly siblings: ReadonlyArray<Installation>
    readonly start: string
    readonly setStart: (value: string) => void
    readonly reset: () => void
}

/** The start a new agent of a role gets unless the owner picks another: a copy of the oldest sibling, else the default setup. */
const suggestedStartOf = (siblings: ReadonlyArray<Installation>): string => {
    const [oldest] = siblings
    return startValueOf(oldest === undefined ? { kind: "default" } : { kind: "copy", installationId: oldest.id })
}

/** The state of the create dialog: the role comes from the address ("+ Add Sales") or is chosen in the dialog ("Create agent"). */
export const useAgentCreateForm = (): AgentCreateForm => {
    const param = useSearchParams().get(CREATE_AGENT_PARAM)
    const member = useMember()
    const { roles } = useCatalogEntries()
    const { installations } = useInstallations()
    const [chosenRole, setChosenRole] = useState<ModuleKey | null>(null)
    const [name, setName] = useState("")
    const [typedHandle, setTypedHandle] = useState<string | null>(null)
    const [chosenChannels, setChosenChannels] = useState<ReadonlyArray<string>>([])
    const [startValue, setStartValue] = useState<string | null>(null)
    const fromParam = roleOfParam(param, isModuleKey)
    const role = fromParam ?? chosenRole
    const siblings = role === null || installations === undefined ? [] : instancesOf(installations, role)
    const channels = useQueryAgentChannelChoicesSwr(param === null || role === null ? null : { moduleKey: role })
    return {
        isOpen: param !== null,
        isRoleOpen: fromParam === null,
        roles,
        role,
        setRole: (value) => {
            setChosenRole(value !== null && isModuleKey(value) ? value : null)
            setChosenChannels([])
            setStartValue(null)
        },
        name,
        setName,
        handle: typedHandle ?? (role === null ? "" : suggestedHandleOf(name, role.replaceAll('_', ""))),
        typedHandle,
        setHandle: setTypedHandle,
        channels,
        chosenChannels,
        setChosenChannels,
        canGrantChannels: member === null || member.role === "owner",
        siblings,
        start: startValue ?? suggestedStartOf(siblings),
        setStart: setStartValue,
        reset: () => {
            setChosenRole(null)
            setName("")
            setTypedHandle(null)
            setChosenChannels([])
            setStartValue(null)
        },
    }
}

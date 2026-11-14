"use client"

import { useTranslations } from "next-intl"
import { installationPersonName } from "@/modules/installations"
import { choiceSrcOf, isPictureChoice } from "@/modules/agentAvatar"
import { useAgentAttachmentProposal } from "@/hooks/providerRights"
import { useAgentCreateForm, type AgentCreateForm } from "./useAgentCreateForm"
import { useAgentCreatePicture, type AgentCreatePicture } from "./useAgentCreatePicture"
import { useAgentCreateSubmit } from "./useAgentCreateSubmit"

/** One start of the setup: a copy of a sibling (its name), or the default setup (no name). */
export interface StartOptionView {
    readonly value: string
    readonly siblingName: string | null
    readonly isSuggested: boolean
}

/** Everything the create dialog draws and calls. */
export interface AgentCreateView extends Omit<AgentCreateForm, "siblings" | "reset" | "typedHandle"> {
    readonly roleName: string
    readonly picture: AgentCreatePicture
    /** The preview of the chosen picture; null lets Grammar draw the sprout or the initials. */
    readonly previewSrc: string | null
    readonly choosePreset: (value: string) => void
    /** The setup starts; empty while the role has no agent to copy. */
    readonly startOptions: ReadonlyArray<StartOptionView>
    /** The account cards of the template with the owner switches. */
    readonly attachments: ReturnType<typeof useAgentAttachmentProposal>
    readonly isCreating: boolean
    readonly create: () => void
    readonly close: () => void
}

/** The role whose mark the presets show while no role is chosen yet. */
const FALLBACK_ROLE = "chatbot"

/** The starts of the setup: a copy of each sibling (the oldest suggested), then the default setup; none while the role has none. */
const startOptionsOf = (form: AgentCreateForm): ReadonlyArray<StartOptionView> =>
    form.siblings.length === 0
        ? []
        : [
              ...form.siblings.map((sibling, index) => ({
                  value: `copy:${sibling.id}`,
                  siblingName: installationPersonName(sibling),
                  isSuggested: index === 0,
              })),
              { value: "default", siblingName: null, isSuggested: false },
          ]

/**
 * The create dialog of the agents page ("Create agent", "+ Add Sales"): the role, the name its customers see, the handle derived
 * from the name (editable), the picture, the accounts its template attaches and where its setup starts. Creating opens the new agent.
 */
export const useAgentCreate = (): AgentCreateView => {
    const t = useTranslations("agentCreate")
    const form = useAgentCreateForm()
    const picture = useAgentCreatePicture()
    const attachments = useAgentAttachmentProposal(form.role)
    const submit = useAgentCreateSubmit(form, picture, t, attachments.input)
    const role = form.role ?? FALLBACK_ROLE
    const choice = picture.choice
    return {
        ...form,
        roleName: form.roles.find((entry) => entry.key === form.role)?.name ?? "",
        picture,
        previewSrc: choice.kind === "upload" ? choice.url : choiceSrcOf(choice.preset, role),
        choosePreset: (value) => {
            if (isPictureChoice(value)) picture.choosePreset(value)
        },
        startOptions: startOptionsOf(form),
        attachments,
        isCreating: submit.isCreating,
        create: () => void submit.create(),
        close: submit.close,
    }
}

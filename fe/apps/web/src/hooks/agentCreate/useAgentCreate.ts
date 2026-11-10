"use client"

import { useTranslations } from "next-intl"
import { PROVIDERS, isProvider } from "@/hooks/connection-providers"
import { installationPersonName } from "@/modules/installations"
import { PICTURE_CHOICES, choiceSrcOf, isPictureChoice } from "@/modules/agentAvatar"
import { useAgentCreateForm, type AgentCreateForm } from "./useAgentCreateForm"
import { useAgentCreatePicture, type AgentCreatePicture } from "./useAgentCreatePicture"
import { useAgentCreateSubmit } from "./useAgentCreateSubmit"

/** One channel a new agent of the role could answer, in the reader language. */
export interface ChannelOptionView {
    readonly value: string
    /** "Telegram - @shop_bot". */
    readonly label: string
    /** The row title: the brand ("Telegram"), or the whole label when the channel has no bot account. */
    readonly title: string
    /** The account under the brand ("@shop_bot"); empty when the title already says it. */
    readonly account: string
    /** The agent of the role that answers it already; null when it is free. */
    readonly ownerName: string | null
}

/** One choice of the picture picker. */
export interface PresetOptionView {
    readonly value: string
    /** The image; null lets Grammar draw the sprout or the initials. */
    readonly src: string | null
    /** The choice is the initials. */
    readonly isInitials: boolean
}

/** One start of the setup: a copy of a sibling (its name), or the default setup (no name). */
export interface StartOptionView {
    readonly value: string
    readonly siblingName: string | null
    readonly isSuggested: boolean
}

/** Everything the create dialog draws and calls. */
export interface AgentCreateView extends Omit<AgentCreateForm, "channels" | "siblings" | "reset" | "typedHandle"> {
    readonly roleName: string
    readonly picture: AgentCreatePicture
    /** The preview of the chosen picture; null lets Grammar draw the sprout or the initials. */
    readonly previewSrc: string | null
    /** The chosen picture is the initials. */
    readonly previewIsInitials: boolean
    readonly presets: ReadonlyArray<PresetOptionView>
    /** The preset worn, or empty while an uploaded file is the picture. */
    readonly preset: string
    readonly choosePreset: (value: string) => void
    readonly channelOptions: ReadonlyArray<ChannelOptionView>
    readonly isChannelsLoading: boolean
    /** The setup starts; empty while the role has no agent to copy. */
    readonly startOptions: ReadonlyArray<StartOptionView>
    readonly isCreating: boolean
    readonly create: () => void
    readonly close: () => void
}

/** The role whose mark the presets show while no role is chosen yet. */
const FALLBACK_ROLE = "chatbot"

/** The row title of a channel: the brand, and for Zalo the official account it is ("Zalo OA"). */
const channelTitleOf = (brand: string): string => (brand === "Zalo" ? "Zalo OA" : brand)

/** The account under the title: the bot, else the connection name when it adds something. */
const accountOf = (bot: string, name: string, title: string): string => {
    if (bot !== "") return `@${bot}`
    return name === title ? "" : name
}

/** The channels of the role in the reader language. */
const channelOptionsOf = (form: AgentCreateForm): ReadonlyArray<ChannelOptionView> =>
    (form.channels.data ?? []).map((channel) => {
        const brand = isProvider(channel.provider) ? PROVIDERS[channel.provider].brand : channel.provider
        const bot = channel.botUsername ?? ""
        const account = bot === "" ? channel.name : "@" + bot
        return {
            value: channel.connectionId,
            label: account === brand ? brand : `${brand} · ${account}`,
            title: channelTitleOf(brand),
            account: accountOf(bot, channel.name, channelTitleOf(brand)),
            ownerName: channel.ownerAgentName ?? null,
        }
    })

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
 * from the name (editable), the picture, the channels it answers (one another agent of the role answers stays disabled) and where its
 * setup starts. Creating opens the new agent.
 */
export const useAgentCreate = (): AgentCreateView => {
    const t = useTranslations("agentCreate")
    const form = useAgentCreateForm()
    const picture = useAgentCreatePicture()
    const submit = useAgentCreateSubmit(form, picture, t)
    const role = form.role ?? FALLBACK_ROLE
    const choice = picture.choice
    return {
        ...form,
        roleName: form.roles.find((entry) => entry.key === form.role)?.name ?? "",
        picture,
        previewSrc: choice.kind === "upload" ? choice.url : choiceSrcOf(choice.preset, role),
        previewIsInitials: choice.kind === "preset" && choice.preset === "initials",
        presets: PICTURE_CHOICES.map((key) => ({
            value: key,
            src: choiceSrcOf(key, role),
            isInitials: key === "initials",
        })),
        preset: choice.kind === "preset" ? choice.preset : "",
        choosePreset: (value) => {
            if (isPictureChoice(value)) picture.choosePreset(value)
        },
        channelOptions: channelOptionsOf(form),
        isChannelsLoading: form.channels.isLoading,
        startOptions: startOptionsOf(form),
        isCreating: submit.isCreating,
        create: () => void submit.create(),
        close: submit.close,
    }
}

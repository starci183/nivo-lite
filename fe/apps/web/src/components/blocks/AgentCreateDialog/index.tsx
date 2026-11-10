"use client"

import { useLocale, useTranslations } from "next-intl"
import { abilityRowsOf, toggleAbility, type RightsTranslate } from "@/components/composites/ProviderRightsCard"
import { useAgentCreate, type AgentCreateView } from "@/hooks/agentCreate"
import { accountTitleOf, pickLabel, providerLabelOf, providerLogoOf, type AbilityMode } from "@/hooks/providerRights"
import { AgentCreateDialogBase, type AgentCreateDialogBaseProps } from "./component"

/** The translator of the dialog copy. */
type CreateCopy = ReturnType<typeof useTranslations<"agentCreate">>

/** The picture field: the preview (Sprout until an upload) and the upload. */
const pictureOf = (view: AgentCreateView, t: CreateCopy): AgentCreateDialogBaseProps["props"]["picture"] => ({
    label: t("pictureLabel"),
    preview: {
        name: view.name.trim() === "" ? t("namePlaceholder") : view.name,
        seed: view.handle === "" ? (view.role ?? "agent") : view.handle,
        src: view.previewSrc,
    },
    editor: { ...view.picture.editor, hint: t("pictureHint") },
})

/**
 * The providers field: one card per connected ACCOUNT of a provider the template names ("Zalo OA · <OA name>"), pre-ticked "by
 * template" (for payment only the shop's default receiving account) and editable; a named provider that is not connected is a dimmed line.
 */
const providersOf = (
    view: AgentCreateView,
    rights: AgentCreateView["abilities"],
    t: RightsTranslate,
    locale: string,
): AgentCreateDialogBaseProps["props"]["providers"] =>
    view.role === null
        ? null
        : {
              label: t("createTitle"),
              chip: t("createChip", { agent: view.roleName }),
              emptyLabel: t("createNone"),
              notConnected: rights.unconnected.map((one) =>
                  t("createNotConnected", { provider: providerLabelOf(one.provider, one.key, locale) }),
              ),
              cards: rights.cards.map(({ provider, account, held }) => {
                  const setAbility = (ability: string, mode: AbilityMode) => rights.setAbility(account.connectionId, ability, mode)
                  return {
                      id: account.connectionId,
                      card: {
                          props: {
                              name: accountTitleOf(pickLabel(provider.label, locale), account.accountLabel),
                              logo: providerLogoOf(provider.provider),
                              line: pickLabel(provider.kindLabel, locale),
                              badge: account.isDefaultReceiving ? t("defaultReceiving") : undefined,
                              menu: undefined,
                              connectLink: undefined,
                              rows: abilityRowsOf(t, locale, provider, held, setAbility),
                          },
                          on: { toggle: (id: string, isOn: boolean) => toggleAbility(provider, held, id, isOn, setAbility) },
                      },
                  }
              }),
          }

/** Where the setup starts: a copy of each sibling, or the default setup; none while the role has no agent. */
const startOf = (view: AgentCreateView, t: CreateCopy): AgentCreateDialogBaseProps["props"]["start"] =>
    view.startOptions.length === 0
        ? null
        : {
              label: t("startLabel"),
              value: view.start,
              items: view.startOptions.map((option) =>
                  option.siblingName === null
                      ? { id: option.value, title: t("startDefault"), subtitle: t("startDefaultHint") }
                      : {
                            id: option.value,
                            title: t("startCopy", { name: option.siblingName }),
                            subtitle: t("startCopyHint"),
                        },
              ),
          }

/**
 * The connected create dialog: opened by the address (`?create=sales` from "+ Add Sales", `?create=new` from "Create agent"), it
 * creates one more agent of a role with the name its customers see, a handle, a picture, its providers by template and where its setup starts.
 */
export const AgentCreateDialog = () => {
    const t = useTranslations("agentCreate")
    const tRights = useTranslations("agentRights")
    const locale = useLocale()
    const view = useAgentCreate()
    const rights = view.abilities
    return (
        <AgentCreateDialogBase
            props={{
                isOpen: view.isOpen,
                title: view.roleName === "" ? t("title") : t("titleRole", { role: view.roleName }),
                closeLabel: t("close"),
                role: view.isRoleOpen
                    ? {
                          label: t("roleLabel"),
                          placeholder: t("rolePlaceholder"),
                          options: view.roles.map((role) => ({ id: role.key, label: role.name })),
                          value: view.role,
                      }
                    : null,
                name: { label: t("nameLabel"), description: t("nameHint"), value: view.name },
                handle: { label: t("handleLabel"), description: t("handleHint"), value: view.handle },
                picture: pictureOf(view, t),
                providers: providersOf(view, rights, tRights, locale),
                start: startOf(view, t),
                submitLabel: t("submit"),
                cancelLabel: t("cancel"),
                failTitle: t("failTitle"),
                isPending: view.isCreating,
            }}
            on={{
                close: view.close,
                role: view.setRole,
                name: view.setName,
                handle: view.setHandle,
                upload: (files) => void view.picture.upload(files),
                removeUpload: () => view.choosePreset("sprout"),
                start: view.setStart,
                submit: view.create,
            }}
        />
    )
}

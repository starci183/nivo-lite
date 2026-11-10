import type { useTranslations } from "next-intl"
import { accountTitleOf, pickLabel, providerLogoOf, type useDefaultReceivingAccount } from "@/hooks/providerRights"
import type { DefaultAccountView } from "./types"

/** The state of the default receiving account. */
type ReceivingState = ReturnType<typeof useDefaultReceivingAccount>

/** One account that can receive. */
type ReceivingAccount = ReceivingState["candidates"][number]

/** The default receiving account section in words; null for a viewer who is not the owner or a shop with no account that can receive. */
export const defaultAccountViewOf = (
    t: ReturnType<typeof useTranslations<"agentRights">>,
    locale: string,
    state: ReceivingState,
): DefaultAccountView | null => {
    if (!state.isOwner || state.candidates.length === 0) return null
    const nameOf = (one: ReceivingAccount): string =>
        accountTitleOf(pickLabel(one.provider.label, locale), one.account.accountLabel)
    const { current } = state
    return {
        title: t("defaultTitle"),
        row:
            current === null
                ? { id: "none", title: t("defaultNoneTitle"), description: t("defaultNoneBody"), name: undefined, logo: undefined }
                : {
                      id: current.account.connectionId,
                      title: nameOf(current),
                      description: t("defaultBody"),
                      name: pickLabel(current.provider.label, locale),
                      logo: providerLogoOf(current.provider.provider),
                  },
        changeLabel: current === null ? t("defaultChoose") : t("defaultChange"),
        picker: {
            isOpen: state.isPickerOpen,
            title: t("defaultPickerTitle"),
            closeLabel: t("close"),
            items: state.candidates.map((one) => ({
                id: one.account.connectionId,
                title: nameOf(one),
                subtitle: pickLabel(one.provider.kindLabel, locale),
            })),
            value: state.picked,
            isSaving: state.isSaving,
            cancelLabel: t("cancel"),
            saveLabel: t("defaultSave"),
        },
    }
}

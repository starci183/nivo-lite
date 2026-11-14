"use client"

import { notFound, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { ConnectionFormContext, useConnectionFormState } from "@/hooks/connectionForm"
import { useProviderPageTabs } from "@/hooks/connectionPage"
import { useProviderCrumb } from "@/hooks/connectionProvider"
import { useConnectionRefusal } from "@/hooks/connections"
import { useConnectionOpenPage } from "@/hooks/connectionsPanes"
import { useWorkspaceId } from "@/hooks/workspaces"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { ConnectionOpenHeadBase } from "./component"

/** The routed page the band sits over. */
interface ConnectionOpenHeadProps {
    readonly children: ReactNode
}

/**
 * The connected band of a connection without a page of its own: name, status, facts, the row's one command and menu, the tabs. It
 * reads the connection its segment layout read once for the band and the tab body. An id that is no connection of the workspace is
 * `notFound()` once. The root of the open route layout: it draws the one Page of every route under it.
 */
export const ConnectionOpenHead = (props: ConnectionOpenHeadProps) => {
    const t = useTranslations("connections")
    const tp = useTranslations("providerPage")
    const params = useParams<{ id?: string }>()
    const form = useConnectionFormState(typeof params.id === "string" ? params.id : "")
    const workspaceId = useWorkspaceId()
    const open = useConnectionOpenPage()
    const providerCrumb = useProviderCrumb(open.provider)
    const tabs = useProviderPageTabs()
    const refusal = useConnectionRefusal()
    /** The account form belongs to the Config tab: its commands are not in the band of the read-only tabs. */
    const isConfigTab = tabs.selectedKey === "config"
    if (open.isMissing && refusal === undefined) notFound()
    const view = "items" in open.slot ? open.slot.items : undefined
    return (
        <ConnectionFormContext.Provider value={form}>
        <ConnectionOpenHeadBase
            props={{
                ...(view === undefined ? {} : { view }),
                ...(open.chip === null ? {} : { chip: { ...open.chip, isDot: false } }),
                glyph: open.glyph,
                crumbsLabel: t("crumbLabel"),
                crumbs: [
                    {
                        id: "connections",
                        label: t("title"),
                        href: workspaceHref(workspaceId, CONSOLE_ROUTES.connections),
                    },
                    ...(providerCrumb === undefined ? [] : [providerCrumb]),
                    { id: "open", label: view?.title ?? t("openLabel") },
                ],
                tabs,
                moreLabel: t("moreActions"),
                ...(refusal === undefined ? {} : { refusal }),
                form: {
                    ...(isConfigTab && form.canTest
                        ? {
                              check: {
                                  label: tp("formCheckAction"),
                                  intent: "neutral" as const,
                                  isPending: form.isTesting,
                                  onPress: form.on.test,
                              },
                          }
                        : {}),
                    ...(isConfigTab && form.canEdit
                        ? {
                              save: {
                                  label: tp("formSaveAction"),
                                  intent: "commit" as const,
                                  isPending: form.isSaving,
                                  isDisabled: !form.isSaveEnabled,
                                  onPress: form.on.save,
                              },
                          }
                        : {}),
                },
            }}
            on={open.on}
        >
            {props.children}
        </ConnectionOpenHeadBase>
        </ConnectionFormContext.Provider>
    )
}

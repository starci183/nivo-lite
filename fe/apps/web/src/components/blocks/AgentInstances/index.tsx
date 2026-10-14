"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAddInstance, useInstanceList } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import { useAddInstanceForm } from "@/hooks/rhf"
import { AGENTS_ROUTE, APP_ROUTES } from "@/modules/routes"
import { AgentInstancesBase } from "./component"

/** What the type page hands the block: the type of the url, the query to carry on and whether the list was asked for. */
interface AgentInstancesProps {
    readonly module: ModuleKey
    readonly query: string
    readonly showList: boolean
}

/** The connected instances of one agent type: reads the installed agents in the browser, redirects when the type has one instance, adds new ones. */
export const AgentInstances = (props: AgentInstancesProps) => {
    const t = useTranslations("modulesCore")
    const ts = useTranslations("shell")
    const member = useMember()
    const list = useInstanceList(props.module, props.query, props.showList ? "list" : "page")
    const { add, isAdding } = useAddInstance()
    const [isOpen, setOpen] = useState(false)
    const form = useAddInstanceForm(list.defaultName, list.names)
    const submit = form.handleSubmit(async (values) => {
        await add(props.module, values.name)
    })

    return (
        <AgentInstancesBase
            props={{
                crumbLabel: ts("crumbLabel"),
                crumbs: [
                    { id: "home", label: ts("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "modules", label: t("catalogTitle"), href: AGENTS_ROUTE },
                    { id: "module", label: list.typeName },
                ],
                eyebrow: t("eyebrow"),
                title: list.typeName,
                description: list.isMulti ? t("instancesDescription", { type: list.typeShort }) : list.typeDescription,
                addLabel:
                    list.isCopyReady && isManager(member) && list.isMulti
                        ? t("instanceAdd", { type: list.typeShort })
                        : null,
                listLabel: t("instancesListLabel", { type: list.typeShort }),
                openLabel: t("openModule"),
                rows: list.rows.map((row) => ({
                    id: row.id,
                    title: row.name,
                    description: [
                        row.channels.length > 0
                            ? t("instanceChannels", { list: row.channels.join(", ") })
                            : t("instanceNoChannels"),
                        row.activeVersion === null ? t("noVersion") : t("versionInUse", { version: row.activeVersion }),
                    ].join(" · "),
                    statusLabel: t(`status_${row.status}`),
                    statusTone: row.statusTone,
                    openHref: row.openHref,
                })),
                isLoading: list.slot.isLoading === true,
                error: list.slot.isError === true ? t("loadFailed") : undefined,
                dialog: isOpen
                    ? {
                          props: {
                              title: t("instanceAddTitle", { type: list.typeShort }),
                              description: t("instanceAddDescription"),
                              closeLabel: t("instanceCancel"),
                              nameLabel: t("instanceNameLabel"),
                              nameHint: t("instanceNameHint", { type: list.typeShort }),
                              createLabel: t("instanceCreate"),
                              name: form.watch("name"),
                              error: form.formState.errors.name?.message,
                              isPending: isAdding,
                              canCreate: form.formState.isValid,
                          },
                          on: {
                              setName: (value) => form.setValue("name", value, { shouldValidate: true }),
                              create: () => void submit(),
                              close: () => setOpen(false),
                          },
                      }
                    : null,
            }}
            on={{
                add: () => {
                    form.reset({ name: list.defaultName })
                    setOpen(true)
                },
            }}
        />
    )
}

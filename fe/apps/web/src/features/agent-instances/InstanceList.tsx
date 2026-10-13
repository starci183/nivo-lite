"use client"

import { useState } from "react"
import {
    Badge,
    Breadcrumbs,
    Button,
    ListRow,
    PageContainer,
    SectionHeader,
    SurfaceListCard,
} from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { modulesCore } from "@/i18n/dict/modulesCore"
import { shell } from "@/i18n/dict/shell"
import { STATUS_TONE, statusOf } from "@/features/modules-core/meta"
import { isMultiInstance, moduleDef, pick } from "@/lib/module-registry"
import { agentHref, nextInstanceName, type Installation, type ModuleKey } from "@/lib/modules-shared"
import { AddInstanceDialog } from "./AddInstanceDialog"
import { HEAD_CLASS_NAME, PAGE_CLASS_NAME } from "./classNames"

/** One instance as the list shows it: the installation plus the names of the connections its agent is bound to. */
export type InstanceRow = { readonly installation: Installation; readonly connections: ReadonlyArray<string> }

type InstanceListProps = {
    readonly moduleKey: ModuleKey
    readonly rows: ReadonlyArray<InstanceRow>
    /** Owners and managers may add an instance. */
    readonly canInstall: boolean
    /** STATE-8: the same page while the instances load - real trail, heading and command; three skeleton rows. */
    readonly isLoading?: boolean
}

/**
 * /agents/<type> when a type has several instances (or ?list=1): every instance as a row with its name, status, bound channels and Open,
 * plus "Thêm <loại> mới" for multi-instance types. A collection of entities, so SurfaceListCard + ListRow (COLLECTION-1 case-7); the page
 * command sits in the SectionHeader action (LAYOUT-1 case-7).
 */
export const InstanceList = ({ moduleKey, rows, canInstall, isLoading = false }: InstanceListProps) => {
    const t = useT(modulesCore)
    const ts = useT(shell)
    const locale = useLocale()
    const [isAdding, setAdding] = useState(false)
    const def = moduleDef(moduleKey)
    const typeName = pick(def.name, locale)
    const typeShort = pick(def.shortName, locale)
    const isMulti = isMultiInstance(moduleKey)
    const names = rows.map((r) => r.installation.name)

    return (
        <PageContainer measure="product">
            <div className={PAGE_CLASS_NAME}>
                <div className={HEAD_CLASS_NAME}>
                    <Breadcrumbs
                        label={ts("crumbLabel")}
                        items={[
                            { id: "home", label: ts("crumbHome"), href: "/dashboard" },
                            { id: "modules", label: t("catalogTitle"), href: "/agents" },
                            { id: "module", label: typeName },
                        ]}
                    />
                    <SectionHeader
                        level={1}
                        eyebrow={t("eyebrow")}
                        title={typeName}
                        description={
                            isMulti ? t("instancesDescription", { type: typeShort }) : pick(def.description, locale)
                        }
                        action={
                            canInstall && isMulti ? (
                                <Button variant="primary" isDisabled={isLoading} onPress={() => setAdding(true)}>
                                    {t("instanceAdd", { type: typeShort })}
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
                <SurfaceListCard
                    label={t("instancesListLabel", { type: typeShort })}
                    headingLevel={2}
                    isLoading={isLoading}
                >
                    {isLoading
                        ? null
                        : rows.map(({ installation, connections }) => {
                              const status = statusOf(installation)
                              const channels = connections.length
                                  ? t("instanceChannels", { list: connections.join(", ") })
                                  : t("instanceNoChannels")
                              const version =
                                  installation.activeVersion === null
                                      ? t("noVersion")
                                      : t("versionInUse", { version: installation.activeVersion })
                              return (
                                  <ListRow
                                      key={installation.id}
                                      title={installation.name}
                                      description={`${channels} · ${version}`}
                                      badges={
                                          <Badge isDot tone={STATUS_TONE[status]}>
                                              {t(`status_${status}`)}
                                          </Badge>
                                      }
                                      actions={
                                          <Button
                                              size="sm"
                                              variant="secondary"
                                              href={agentHref(moduleKey, installation.id)}
                                          >
                                              {t("openModule")}
                                          </Button>
                                      }
                                  />
                              )
                          })}
                </SurfaceListCard>
                {isAdding ? (
                    <AddInstanceDialog
                        moduleKey={moduleKey}
                        typeName={typeShort}
                        defaultName={nextInstanceName(typeShort, names)}
                        taken={names}
                        onClose={() => setAdding(false)}
                    />
                ) : null}
            </div>
        </PageContainer>
    )
}

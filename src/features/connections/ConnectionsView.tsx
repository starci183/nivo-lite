"use client"

import { PageContainer, TextAction } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections as dict } from "@/i18n/dict/connections"
import { PAGE_CLASS } from "./classNames"
import { ConnectionsBoard, type ConnectionsBoardProps } from "./ConnectionsBoard"

/** The Connections page body: the grouped board and the link to automations. With `isLoading` it is the same page with no data yet (STATE-8). */
export const ConnectionsView = (props: ConnectionsBoardProps) => {
  const t = useT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <ConnectionsBoard {...props} />
        <TextAction href="/automations" isSkeleton={props.isLoading}>{t("automationsLink")}</TextAction>
      </div>
    </PageContainer>
  )
}

"use client"

import { Badge } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import type { ConnectionStatus } from "@/lib/channels"

/** One status chip for a connection: connected, needs attention or disconnected. */
export const StatusBadge = ({ status }: { readonly status: ConnectionStatus }) => {
  const t = useT(connections)
  return (
    <Badge isDot tone={status === "connected" ? "success" : status === "error" ? "danger" : "neutral"}>
      {status === "connected" ? t("statusConnected") : status === "error" ? t("statusError") : t("statusDisconnected")}
    </Badge>
  )
}

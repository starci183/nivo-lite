"use client"

import { Alert, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorImap } from "@/i18n/dict/connectorImap"
import { useImapMailbox } from "@/hooks/imap-wizard"
import { ImapWizardBody } from "./ImapWizardBody"
import type { DataWizardProps } from "./types"

/** The mailbox (IMAP, read only) wizard, owner only: reads the saved mailbox when resuming, then hands over to the steps. */
export const ImapWizard = ({ agents, resumeId, onClose }: DataWizardProps) => {
    const t = useT(connectorImap)
    const { loading, view, error } = useImapMailbox(resumeId)
    if (loading) return <Text tone="muted">{t("loading")}</Text>
    if (error !== null) return <Alert tone="negative" title={error} />
    return <ImapWizardBody agents={agents} mailbox={view} onClose={onClose} />
}

"use client"

import { Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorDatabase } from "@/i18n/dict/connectorDatabase"
import { useDatabaseSaved } from "@/hooks/database-wizard"
import { DatabaseSetup } from "./database/DatabaseSetup"
import type { DataWizardProps } from "./types"

/** Setup of a business database connection (owner only): loads the saved connection when resuming, then hands over to the setup steps. */
export const DatabaseWizard = (props: DataWizardProps) => {
    const t = useT(connectorDatabase)
    const { saved, isLoading, error } = useDatabaseSaved(props.resumeId)
    if (isLoading)
        return (
            <Text size="sm" tone="muted" live="polite">
                {t("loading")}
            </Text>
        )
    return <DatabaseSetup {...props} saved={saved} loadError={error} />
}

"use client"

import type { Provider } from "@/lib/connection-providers"
import { CsvImportWizard } from "./CsvImportWizard"
import { DatabaseWizard } from "./DatabaseWizard"
import { ImapWizard } from "./ImapWizard"
import { OpenApiWizard } from "./OpenApiWizard"
import { TelegramUserWizard } from "./TelegramUserWizard"
import type { DataWizardProps } from "./types"

/** The wizard of one data provider. Each provider owns its own file; this switch never needs to change. */
export const DataWizard = ({ provider, ...props }: DataWizardProps & { readonly provider: Provider }) =>
  provider === "openapi" ? <OpenApiWizard {...props} />
  : provider === "database" ? <DatabaseWizard {...props} />
  : provider === "csv_import" ? <CsvImportWizard {...props} />
  : provider === "imap" ? <ImapWizard {...props} />
  : provider === "telegram_user" ? <TelegramUserWizard {...props} />
  : null

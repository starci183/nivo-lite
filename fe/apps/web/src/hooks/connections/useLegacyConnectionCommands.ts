import { syncNow } from "@/lib/data-hub-actions"
import { changeSmtpPassword, sendSmtpTest, setDefaultSmtp } from "@/lib/email-actions"

/**
 * The commands of a row that still belong to another lane's server actions: a data sync of the knowledge hub and the SMTP mailbox
 * commands of the email lane. They already answer a sentence; this hook goes away when those lanes move them behind the api.
 */
const COMMANDS = {
    syncNow,
    sendSmtpTest: (connectionId: string, to: string) => sendSmtpTest(connectionId, to, false),
    changeSmtpPassword,
    setDefaultSmtp,
} as const

/** The row commands owned by other lanes. */
export const useLegacyConnectionCommands = (): typeof COMMANDS => COMMANDS

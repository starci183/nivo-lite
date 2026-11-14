import type { AccountDataTypeDef } from "@modules/domain/account-data"
import { WEBHOOK_DATA_TYPES } from "@modules/domain/agent-inbound"
import { BANK_FEED_DATA_TYPES } from "@modules/domain/bank-feed-inbox"
import { CREATOMATE_RENDER_DATA_TYPE } from "@modules/domain/creatomate-provider"
import { IMAP_DATA_TYPES } from "@modules/domain/data-records"
import { SMTP_DATA_TYPES } from "@modules/domain/email-messages"
import { JSON2VIDEO_DATA_TYPES } from "@modules/domain/json2video-provider"
import { META_DATA_TYPES } from "@modules/domain/meta-inbox"
import { SHOTSTACK_DATA_TYPES } from "@modules/domain/shotstack-provider"
import { TELEGRAM_DATA_TYPES } from "@modules/domain/telegram-inbox"
import { INTERFACE_DATA_TYPES } from "@modules/domain/workbench-door"
import { ZALO_DATA_TYPES } from "@modules/domain/zalo-inbox"

/**
 * Every declared account data type of the app, ONE list: the apps register the account-data capability with it, and `cli account-data
 * plan` and the manifest read the same list. Each provider capability adds its own import and spread line here (append only, sorted
 * by provider); a name may be declared once.
 */
export const ACCOUNT_DATA_CATALOG: ReadonlyArray<AccountDataTypeDef> = [
    ...BANK_FEED_DATA_TYPES,
    CREATOMATE_RENDER_DATA_TYPE,
    ...IMAP_DATA_TYPES,
    ...INTERFACE_DATA_TYPES,
    ...JSON2VIDEO_DATA_TYPES,
    ...META_DATA_TYPES,
    ...SHOTSTACK_DATA_TYPES,
    ...SMTP_DATA_TYPES,
    ...TELEGRAM_DATA_TYPES,
    ...WEBHOOK_DATA_TYPES,
    ...ZALO_DATA_TYPES,
]

export { META_ERROR_KINDS, MetaError, MetaErrorCode } from "./errors/meta.error"
export { parseMetaConfig } from "./meta.config"
export { HOUR_MS, INSTAGRAM_FIELDS, META_SCOPES, META_STATE_PURPOSE, PAGE_FIELDS } from "./meta.contracts"
export type {
    AppObject,
    AppSubscriptionResult,
    MessageTag,
    MetaEvent,
    MetaFailure,
    MetaLead,
    MetaPageAccess,
    MetaPageChoice,
    MetaPlatform,
    MetaState,
    MetaStateInput,
    MetaSubscriptionStatus,
    PrivateReplyVerdict,
    SendResult,
    WindowVerdict,
} from "./meta.contracts"
export { META_CLIENT, InjectMetaClient } from "./meta.decorators"
export type { MetaClient } from "./meta.client"
export { MetaModule } from "./meta.module"
export type { MetaApp, MetaOptions } from "./meta.options"
export { classifyGraphError } from "./meta-failure.policy"
export { safeReturnTo } from "./meta-state.policy"
export { isPublicSite } from "./meta-url.policy"
export { checkMessagingWindow, checkPrivateReply, chunkText } from "./meta-window.policy"
export { META_MESSAGES } from "./messages/meta.messages"

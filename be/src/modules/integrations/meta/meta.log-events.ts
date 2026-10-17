/** Log events of the meta integration. */
export enum MetaLogEvent {
    /** The long-lived user token could not be obtained; the short-lived one is kept. */
    LongLivedUnavailable = "meta.long_token_unavailable",
    /** The app-level webhook subscriptions could not be read; the check reports them as unknown. */
    AppSubscriptionsUnavailable = "meta.app_subscriptions_unavailable",
    /** The profile name of a customer could not be read; the conversation goes unnamed. */
    ProfileUnavailable = "meta.profile_unavailable",
    /** The text of an Instagram mention could not be read. */
    MentionUnavailable = "meta.mention_unavailable",
}

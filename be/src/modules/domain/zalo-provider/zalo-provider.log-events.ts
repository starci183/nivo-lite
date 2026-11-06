/** Log events of the Zalo provider's profile round: ids, counts and codes only, never a customer's name. */
export enum ZaloProviderLogEvent {
    /** The profile of a customer could not be read: the conversation keeps its name and is tried again later. */
    ProfileFailed = "zalo_provider.profile_failed",
    /** A connection's profile round stopped early (its rate limit, or the internal agent that calls the door is missing); the rest waits for the next round. */
    ProfileRoundStopped = "zalo_provider.profile_round_stopped",
    /** One profile round finished: how many customers were read and how many failed ride in the fields. */
    ProfilesDone = "zalo_provider.profiles_done",
}

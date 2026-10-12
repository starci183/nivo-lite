/** Log events of the Supabase integration. */
export enum SupabaseLogEvent {
    /** An invitation could not be handed to Auth; the person gets a link to copy instead. */
    InviteDeliveryFailed = "supabase.invite.delivery_failed",
}

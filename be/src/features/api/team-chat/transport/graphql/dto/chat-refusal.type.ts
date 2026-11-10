import { registerEnumType } from "@nestjs/graphql"

/** Why a team chat mutation refused, as data. */
export const ChatRefusal = {
    not_found: "not_found",
    not_member: "not_member",
    forbidden: "forbidden",
    direct_needs_two: "direct_needs_two",
    group_needs_name: "group_needs_name",
    member_unknown: "member_unknown",
    already_member: "already_member",
    not_a_member_to_remove: "not_a_member_to_remove",
    last_owner: "last_owner",
    body_empty: "body_empty",
    body_too_long: "body_too_long",
    too_many_mentions: "too_many_mentions",
    too_many_files: "too_many_files",
    file_too_large: "file_too_large",
    file_type_not_allowed: "file_type_not_allowed",
    storage_unavailable: "storage_unavailable",
    purpose_invalid: "purpose_invalid",
    purpose_taken: "purpose_taken",
    post_right_needs_seat: "post_right_needs_seat",
    reaction_invalid: "reaction_invalid",
    reaction_rate_limited: "reaction_rate_limited",
    decision_not_found: "decision_not_found",
    not_an_approver: "not_an_approver",
    decision_closed: "decision_closed",
}

registerEnumType(ChatRefusal, { name: "ChatRefusal" })

/** Log events of the chat turns: ids, codes and counts only, never the words of a person. */
export enum TeamChatTurnsLogEvent {
    /** A person's message started the chat turn of an agent (`agentId`, `roomId`). */
    TurnStarted = "team_chat_turns.turn_started",
    /** A person's message for an agent started no turn (`code`: no_chat_turn, no_agent, duplicate, not_tagged). */
    TurnSkipped = "team_chat_turns.turn_skipped",
    /** A room reached its limit of turns: the agent said once that it pauses (`roomId`). */
    RoomPaused = "team_chat_turns.room_paused",
    /** The router failed on a message; the message stays written, no turn started. */
    RouteFailed = "team_chat_turns.route_failed",
    /** "Ghi vào Second Brain" on a message (`outcome`). */
    Captured = "team_chat_turns.captured",
}

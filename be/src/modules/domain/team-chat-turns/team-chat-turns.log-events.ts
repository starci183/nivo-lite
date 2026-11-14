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
    /**
     * With the node rights deciding, agents a message named started no chat turn: the old tag path was kept shut for them and the
     * room was told (`roomId`, `count`, `codes`).
     */
    FallbackClosed = "team_chat_turns.fallback_closed",
    /** The line that tells the room of turns that did not start could not be written (`roomId`). */
    UnhandledNotPosted = "team_chat_turns.unhandled_not_posted",
    /** An agent that held no workflow from its module's chat-turn template was given it before its first turn (`agentId`). */
    ChatTurnSeeded = "team_chat_turns.chat_turn_seeded",
    /** Giving an agent its chat-turn workflow failed; the turn went on and the engine reports a wake nothing takes (`agentId`). */
    ChatTurnSeedFailed = "team_chat_turns.chat_turn_seed_failed",
    /** "Save to Second Brain" on a message (`outcome`). */
    Captured = "team_chat_turns.captured",
}

import type { TemplateCatalogue, TemplateGraph } from "@nivo-lite/agent-sdk/template"
import { teamChatGraphOf, teamChatNode } from "@nivo-lite/blocks-core"

/** The key of the Mailbox agent's chat turn with the team. */
export const WEBMAIL_TEAM_CHAT_KEY = "webmail.team-chat"

/** What the template catalogue shows of `webmail.team-chat` version 5: the texts of version 4, the change note of 5 (a declined answer post ends the turn `declined`). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Tr\u1ea3 l\u1eddi \u0111\u1ed9i", en: "Answer the team" },
    summary: {
        vi: "Tr\u1ea3 l\u1eddi ng\u01b0\u1eddi trong \u0111\u1ed9i trong chat ri\u00eang ho\u1eb7c khi \u0111\u01b0\u1ee3c g\u1ecdi t\u00ean trong ph\u00f2ng chung; \u0111\u1ec1 ngh\u1ecb s\u1eeda Second Brain khi ch\u1ee7 \u0111\u1ed5i m\u1ed9t quy \u0111\u1ecbnh",
        en: "Answers the team's people in the private chat or when called by name in a shared room; proposes a Second Brain change when the owner changes a rule",
    },
    version: 5,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T01:00:00.000Z",
    notes: {
        vi: "Khi m\u1ed9t ng\u01b0\u1eddi t\u1eeb ch\u1ed1i \u0111\u0103ng c\u00e2u tr\u1ea3 l\u1eddi tr\u00ean th\u1ebb duy\u1ec7t, l\u01b0\u1ee3t chat k\u1ebft th\u00fac \u1edf k\u1ebft qu\u1ea3 'declined' (m\u1ed9t quy\u1ebft \u0111\u1ecbnh, kh\u00f4ng ph\u1ea3i l\u1ed7i)",
        en: "When a person declines posting the answer on its approval card, the chat turn ends with the outcome 'declined' (a decision, not a failure)",
    },
}

/**
 * `webmail.team-chat` version 2 ("Answer the team"): the blocks-core chat turn (`team.chat` -> `team.truth-propose` when a proposal was
 * written -> `team.answer-post`), built by blocks-core's one builder. The Mailbox holds no CRM account, so the answer turn is blocks-core's
 * own `team.chat` (truth and document reads only). Change from version 1: the turn is split in three one-feature steps. Its catalogue
 * entry is its own (version 2, passed to the builder; blocks-core's own modules carry version 5).
 */
export const webmailTeamChatGraph: TemplateGraph = teamChatGraphOf("webmail", teamChatNode, CATALOGUE)

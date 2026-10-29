import { LEADS_MESSAGES } from "@modules/domain/leads"
import { LEAD_FLOWS_MESSAGES } from "@modules/domain/lead-flows"
import { CONTRACTS_MESSAGES } from "@modules/domain/contracts"
import { LIVENESS_MESSAGES } from "@modules/domain/liveness"
import { IDENTITY_MESSAGES } from "@modules/domain/identity"
import { PASSPORT_MESSAGES } from "@modules/integrations/passport"
import { INVENTORY_MESSAGES } from "@modules/domain/inventory"
import { SHIFTS_MESSAGES } from "@modules/domain/shifts"
import { HIRING_MESSAGES } from "@modules/domain/hiring"
import { JOBS_MESSAGES } from "@modules/platform/jobs"
import { PLATFORM_ADMIN_MESSAGES } from "@modules/domain/platform-admin"
import { BRAIN_FACTS_MESSAGES } from "@modules/domain/brain-facts"
import { BRAIN_LESSONS_MESSAGES } from "@modules/domain/brain-lessons"
import { BRAIN_MESSAGES } from "@modules/domain/brain"
import { KNOWLEDGE_MESSAGES } from "@modules/domain/knowledge"
import { KNOWLEDGE_SOURCES_MESSAGES } from "@modules/domain/knowledge-sources"
import { N8N_RUNS_MESSAGES } from "@modules/domain/n8n-runs"
import { BOOKINGS_MESSAGES } from "@modules/domain/bookings"
import { LOYALTY_CAMPAIGNS_MESSAGES } from "@modules/domain/loyalty-campaigns"
import { LOYALTY_LEDGER_MESSAGES } from "@modules/domain/loyalty-ledger"
import { LOYALTY_MESSAGES } from "@modules/domain/loyalty"
import { LOYALTY_OTPS_MESSAGES } from "@modules/domain/loyalty-otps"
import { RESPONSIBILITIES_MESSAGES } from "@modules/domain/responsibilities"
import { MODULES_MESSAGES } from "@modules/domain/modules"
import { NIVO_KNOWLEDGE_MESSAGES } from "@modules/domain/nivo-knowledge"
import { PUBLIC_API_MESSAGES } from "@modules/domain/public-api"
import { QUEUE_MESSAGES } from "@modules/platform/queue"
import { WORKSPACE_INVITES_MESSAGES } from "@modules/domain/workspace-invites"
import { WORKSPACE_MEMBERS_MESSAGES } from "@modules/domain/workspace-members"
import { WORKSPACES_MESSAGES } from "@modules/domain/workspaces"
import { FFMPEG_MESSAGES } from "@modules/integrations/ffmpeg"
import { TTS_MESSAGES } from "@modules/integrations/tts"
import { VIDEO_MESSAGES } from "@modules/domain/video"

/** App-wide messages catalog, preserving registration order. */
export const API_MESSAGES_3 = [
    IDENTITY_MESSAGES,
    PASSPORT_MESSAGES,
    INVENTORY_MESSAGES,
    SHIFTS_MESSAGES,
    HIRING_MESSAGES,
    JOBS_MESSAGES,
    PLATFORM_ADMIN_MESSAGES,
    BRAIN_FACTS_MESSAGES,
    BRAIN_LESSONS_MESSAGES,
    BRAIN_MESSAGES,
    KNOWLEDGE_MESSAGES,
    KNOWLEDGE_SOURCES_MESSAGES,
    N8N_RUNS_MESSAGES,
    BOOKINGS_MESSAGES,
    LOYALTY_CAMPAIGNS_MESSAGES,
    LOYALTY_LEDGER_MESSAGES,
    LOYALTY_MESSAGES,
    LOYALTY_OTPS_MESSAGES,
    LEADS_MESSAGES,
    LEAD_FLOWS_MESSAGES,
    RESPONSIBILITIES_MESSAGES,
    CONTRACTS_MESSAGES,
    LIVENESS_MESSAGES,
    MODULES_MESSAGES,
    NIVO_KNOWLEDGE_MESSAGES,
    PUBLIC_API_MESSAGES,
    QUEUE_MESSAGES,
    WORKSPACE_INVITES_MESSAGES,
    WORKSPACE_MEMBERS_MESSAGES,
    WORKSPACES_MESSAGES,
    FFMPEG_MESSAGES,
    TTS_MESSAGES,
    VIDEO_MESSAGES,
]

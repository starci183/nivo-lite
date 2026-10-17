import { LEADS_ERROR_KINDS } from "@modules/domain/leads"
import { LEAD_FLOWS_ERROR_KINDS } from "@modules/domain/lead-flows"
import { CONTRACTS_ERROR_KINDS } from "@modules/domain/contracts"
import { LIVENESS_ERROR_KINDS } from "@modules/domain/liveness"
import { JOBS_ERROR_KINDS } from "@modules/platform/jobs"
import { BRAIN_ERROR_KINDS } from "@modules/domain/brain"
import { BRAIN_FACTS_ERROR_KINDS } from "@modules/domain/brain-facts"
import { BRAIN_LESSONS_ERROR_KINDS } from "@modules/domain/brain-lessons"
import { KNOWLEDGE_ERROR_KINDS } from "@modules/domain/knowledge"
import { KNOWLEDGE_SOURCES_ERROR_KINDS } from "@modules/domain/knowledge-sources"
import { N8N_ERROR_KINDS } from "@modules/integrations/n8n"
import { N8N_RUNS_ERROR_KINDS } from "@modules/domain/n8n-runs"
import { QUEUE_ERROR_KINDS } from "@modules/platform/queue"
import { IDENTITY_ERROR_KINDS } from "@modules/domain/identity"
import { INVENTORY_ERROR_KINDS } from "@modules/domain/inventory"
import { SHIFTS_ERROR_KINDS } from "@modules/domain/shifts"
import { HIRING_ERROR_KINDS } from "@modules/domain/hiring"
import { PLATFORM_ADMIN_ERROR_KINDS } from "@modules/domain/platform-admin"
import { MODULES_ERROR_KINDS } from "@modules/domain/modules"
import { NIVO_KNOWLEDGE_ERROR_KINDS } from "@modules/domain/nivo-knowledge"
import { PUBLIC_API_ERROR_KINDS } from "@modules/domain/public-api"
import { SUPABASE_ERROR_KINDS } from "@modules/integrations/supabase"
import { BOOKINGS_ERROR_KINDS } from "@modules/domain/bookings"
import { LOYALTY_CAMPAIGNS_ERROR_KINDS } from "@modules/domain/loyalty-campaigns"
import { LOYALTY_ERROR_KINDS } from "@modules/domain/loyalty"
import { LOYALTY_LEDGER_ERROR_KINDS } from "@modules/domain/loyalty-ledger"
import { LOYALTY_OTPS_ERROR_KINDS } from "@modules/domain/loyalty-otps"
import { WORKSPACE_INVITES_ERROR_KINDS } from "@modules/domain/workspace-invites"
import { WORKSPACE_MEMBERS_ERROR_KINDS } from "@modules/domain/workspace-members"
import { WORKSPACES_ERROR_KINDS } from "@modules/domain/workspaces"
import { FFMPEG_ERROR_KINDS } from "@modules/integrations/ffmpeg"
import { TTS_ERROR_KINDS } from "@modules/integrations/tts"

/** App-wide errors catalog, preserving registration order. */
export const API_ERROR_KINDS_3 = [
    JOBS_ERROR_KINDS,
    BRAIN_ERROR_KINDS,
    BRAIN_FACTS_ERROR_KINDS,
    BRAIN_LESSONS_ERROR_KINDS,
    KNOWLEDGE_ERROR_KINDS,
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    N8N_ERROR_KINDS,
    N8N_RUNS_ERROR_KINDS,
    QUEUE_ERROR_KINDS,
    IDENTITY_ERROR_KINDS,
    INVENTORY_ERROR_KINDS,
    SHIFTS_ERROR_KINDS,
    HIRING_ERROR_KINDS,
    PLATFORM_ADMIN_ERROR_KINDS,
    MODULES_ERROR_KINDS,
    NIVO_KNOWLEDGE_ERROR_KINDS,
    PUBLIC_API_ERROR_KINDS,
    SUPABASE_ERROR_KINDS,
    BOOKINGS_ERROR_KINDS,
    LOYALTY_CAMPAIGNS_ERROR_KINDS,
    LOYALTY_ERROR_KINDS,
    LOYALTY_LEDGER_ERROR_KINDS,
    LOYALTY_OTPS_ERROR_KINDS,
    LEADS_ERROR_KINDS,
    LEAD_FLOWS_ERROR_KINDS,
    CONTRACTS_ERROR_KINDS,
    LIVENESS_ERROR_KINDS,
    WORKSPACE_INVITES_ERROR_KINDS,
    WORKSPACE_MEMBERS_ERROR_KINDS,
    WORKSPACES_ERROR_KINDS,
    FFMPEG_ERROR_KINDS,
    TTS_ERROR_KINDS,
]

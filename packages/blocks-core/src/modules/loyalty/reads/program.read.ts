import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { programOf } from "../config-store"
import { CAMPAIGNS_SHOWN, LOYALTY_VIEW } from "../constants"
import { campaignViewOf, programViewOf } from "../mappers"
import { loyaltyCampaigns, loyaltyProgram } from "../ports"
import type { CampaignRowView, ProgramView } from "../views.types"

const PROGRAM_FIELDS: ReadonlyArray<keyof ProgramView> = [
    "name",
    "enabled",
    "slug",
    "publicPath",
    "perThousandVnd",
    "perVisit",
    "minOrderVnd",
    "trigger",
    "expiryMonths",
    "warnDays",
    "birthdayOn",
    "birthdayPoints",
    "birthdayReward",
    "birthdayNote",
    "maxPerMonth",
    "hourFrom",
    "hourTo",
    "batch",
]

/** `loyalty.program`: the programme with its rules flat; the starter rules before the first save. */
export const programRead: ReadDefinition = defineRead({
    id: "loyalty.program",
    dataKind: "loyalty-program",
    shape: "record",
    fields: PROGRAM_FIELDS,
    paths: {},
    variables: z.object({}),
    permission: LOYALTY_VIEW,
    ports: { program: loyaltyProgram },
    run: async ({ program }): Promise<ProgramView> => programViewOf(await programOf(program)),
})

/** `loyalty.campaigns`: the newest promotions with their delivery counts. */
export const campaignsRead: ReadDefinition = defineRead({
    id: "loyalty.campaigns",
    dataKind: "loyalty-campaign",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables: z.object({}),
    permission: LOYALTY_VIEW,
    ports: { campaigns: loyaltyCampaigns },
    run: async ({ campaigns }): Promise<{ readonly rows: ReadonlyArray<CampaignRowView> }> => ({
        rows: (await campaigns.list(CAMPAIGNS_SHOWN)).map(campaignViewOf),
    }),
})

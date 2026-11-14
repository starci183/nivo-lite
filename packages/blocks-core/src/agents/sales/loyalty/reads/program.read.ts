import { SALES_VIEW } from "../../constants"
import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { programOf } from "../config-store"
import { CAMPAIGNS_SHOWN } from "../constants"
import { campaignViewOf, programViewOf } from "../mappers"
import { campaignsList } from "../loyalty-catalogue-data"
import { CAMPAIGNS, PROGRAM } from "../ports"
import type { CampaignRowView, ProgramView } from "../views.types"

const PROGRAM_FIELDS: ReadonlyArray<keyof ProgramView> = [
    "name",
    "enabled",
    "state",
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

/** `blocks-core.sales.api.loyalty-program.get`: the programme with its rules flat; the starter rules before the first save. */
export const programRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.loyalty-program.get",
    dataKind: "loyalty-program",
    shape: "record",
    fields: PROGRAM_FIELDS,
    paths: {},
    variables: z.object({}),
    permission: SALES_VIEW,
    ports: { program: PROGRAM },
    run: async ({ program }): Promise<ProgramView> => programViewOf(await programOf(program)),
})

/** `blocks-core.sales.api.loyalty-campaign.list`: the newest promotions with their delivery counts. */
export const campaignsRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.loyalty-campaign.list",
    dataKind: "loyalty-campaign",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables: z.object({}),
    permission: SALES_VIEW,
    ports: { campaigns: CAMPAIGNS },
    run: async ({ campaigns }): Promise<{ readonly rows: ReadonlyArray<CampaignRowView> }> => ({
        rows: (await campaignsList(campaigns, CAMPAIGNS_SHOWN)).map((item) => campaignViewOf(item)),
    }),
})

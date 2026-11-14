import { TOOL } from "@nivo-lite/agent-sdk/names"
import { PLUGIN_TOOL_DECLARATIONS, type PluginToolDeclaration } from "@nivo-lite/agent-sdk/plugin-tools"
import { defineService, type ServiceDefinition } from "@nivo-lite/agent-sdk/service"
import { SALES_MODULE_KEY } from "../declaration"
import {
    LEAD_CARE_GET_INPUT_SCHEMA,
    LEAD_CARE_GET_SCHEMA,
    LEAD_ORDER_LIST_INPUT_SCHEMA,
    LEAD_ORDER_LIST_SCHEMA,
    ORDER_GET_INPUT_SCHEMA,
    ORDER_GET_SCHEMA,
    ORDER_OPEN_LIST_INPUT_SCHEMA,
    ORDER_OPEN_LIST_SCHEMA,
    PAYMENT_CLAIM_LIST_INPUT_SCHEMA,
    PAYMENT_CLAIM_LIST_SCHEMA,
} from "./sales-tools.schema"

/** The sales reads of the `nivo` connector, as the engine lists them (static: read at boot, with no workspace). */
export const SALES_TOOL_DECLARATIONS: ReadonlyArray<PluginToolDeclaration> = [
    {
        id: TOOL.leadOrderList,
        description:
            "The latest orders of the customer this run serves, newest first, with their status and how each delivery goes. Takes no customer id.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: LEAD_ORDER_LIST_INPUT_SCHEMA,
        argumentSchema: LEAD_ORDER_LIST_SCHEMA,
        secretFields: ["notice", "recipientName", "recipientPhone", "deliveryAddress", "note"],
    },
    {
        id: TOOL.orderGet,
        description:
            "One order by its id: its number, status, total, lines and how its delivery goes. Only an order of the customer this run serves, when it serves one.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: ORDER_GET_INPUT_SCHEMA,
        argumentSchema: ORDER_GET_SCHEMA,
        secretFields: ["recipientName", "recipientPhone", "address", "note"],
    },
    {
        id: TOOL.orderOpenList,
        description:
            "The orders that wait for money (confirmed, invoiced), newest first: number, total, status. The customer of an order is named only when it is the customer this run serves.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: ORDER_OPEN_LIST_INPUT_SCHEMA,
        argumentSchema: ORDER_OPEN_LIST_SCHEMA,
    },
    {
        id: TOOL.paymentClaimList,
        description:
            "What customers said they paid that still waits for the money: amount, the names they gave, their words, when. The customer this run serves when it serves one; otherwise the open claims of the shop, without their customer.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: PAYMENT_CLAIM_LIST_INPUT_SCHEMA,
        argumentSchema: PAYMENT_CLAIM_LIST_SCHEMA,
        secretFields: ["names", "words"],
    },
    {
        id: TOOL.leadCareGet,
        description:
            "What care knows of the customer this run serves: whether they asked not to be written to, who receives, and the dates they mentioned. Takes no customer id.",
        scope: "read",
        defaultMode: "auto",
        inputSchema: LEAD_CARE_GET_INPUT_SCHEMA,
        argumentSchema: LEAD_CARE_GET_SCHEMA,
        secretFields: ["recipient", "address"],
    },
]

/** The sales module's declaration of the tools it serves: pure data, so the engine lists them with no port and no workspace. */
export const SALES_TOOL_DECLARATIONS_SERVICE: ServiceDefinition<{ readonly tools: ReadonlyArray<PluginToolDeclaration> }, Record<string, never>> =
    defineService({
        id: "blocks-core.sales.plugin-tool-declarations",
        moduleKey: SALES_MODULE_KEY,
        contract: PLUGIN_TOOL_DECLARATIONS,
        ports: {},
        build: () => ({ tools: SALES_TOOL_DECLARATIONS }),
    })

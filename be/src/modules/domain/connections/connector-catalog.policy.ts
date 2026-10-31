/** official: built and proven; early: built from public docs; soon: planned, not connectable yet. */
export type ConnectorStatus = "official" | "early" | "soon"

/** The catalog status of a connector; undefined when the catalog does not list it. */
export type OptionalConnectorStatus = ConnectorStatus | undefined

const STATUS_BY_ID: Readonly<Record<string, ConnectorStatus>> = {
    sepay: "official",
    payos: "early",
    casso: "official",
    telegram: "official",
    zalo_oa: "early",
    meta: "early",
    telegram_user: "early",
    database: "official",
    openapi: "official",
    csv_import: "official",
    imap: "official",
    smtp: "official",
    google: "official",
    webhook: "official",
    tiktok_chat: "soon",
    shopee: "soon",
    tiktok_shop: "soon",
    lazada: "soon",
    kiotviet: "soon",
    sapo: "soon",
    haravan: "soon",
    shopify: "soon",
    woocommerce: "soon",
    misa_amis: "soon",
    misa_meinvoice: "soon",
    viettel_sinvoice: "soon",
    vnpay: "soon",
    momo: "soon",
    ghn: "soon",
    ghtk: "soon",
    google_calendar: "soon",
    google_drive: "early",
    notion: "soon",
    slack: "soon",
    airtable: "soon",
}

/** The catalog status of a connector id, or undefined when the catalog does not list it. */
export const connectorStatusOf = (connectorId: string): OptionalConnectorStatus =>
    Object.hasOwn(STATUS_BY_ID, connectorId) ? STATUS_BY_ID[connectorId] : undefined

/** True for a planned connector, the only kind an owner can say they want. */
export const isPlannedConnector = (connectorId: string): boolean => connectorStatusOf(connectorId) === "soon"

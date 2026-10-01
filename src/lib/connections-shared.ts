/** Client-safe: which connection providers each module can use (see PURPOSE in connection-actions for what each means). */
export const MODULE_PROVIDERS = {
  chatbot: ["telegram", "zalo_oa"],
  sales: ["telegram"],
  accounting: ["sepay", "payos", "casso"],
} as const;

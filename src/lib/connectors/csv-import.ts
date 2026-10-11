import "server-only";
import type { Connector } from "../data-hub";

/** Excel / CSV import: each uploaded file becomes hub rows (sync re-reads nothing; uploads call upsert directly). */
export const connector: Connector = {
  sync: async () => {
    throw new Error("Kết nối này đang được hoàn thiện.");
  },
};

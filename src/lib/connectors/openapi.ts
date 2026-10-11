import "server-only";
import type { Connector } from "../data-hub";

/** Swagger / OpenAPI: pull the chosen GET endpoints into the hub; agents may call the endpoints the owner allowed. */
export const connector: Connector = {
  sync: async () => {
    throw new Error("Kết nối này đang được hoàn thiện.");
  },
};

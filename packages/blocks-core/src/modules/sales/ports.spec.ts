import { salesLeads, salesLeadsList, salesOrders, salesOrdersList } from "./ports"

describe("the ports of the Sales module", () => {
    it("bind the two entities to the engine and name the two list sources", () => {
        expect(salesLeads.id).toBe("engine.entity.sales.lead")
        expect(salesOrders.id).toBe("engine.entity.sales.order")
        expect(salesLeadsList.id).toBe("sales.leads-list")
        expect(salesOrdersList.id).toBe("sales.orders-list")
    })
})

-- A write's inbox claim and sealed pending outcome commit before its connector
-- call. Even a crash before saving the final answer cannot reissue the action.
CREATE TABLE public.mcp_gateway_receipts (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    operation_key text NOT NULL,
    result_sealed text NOT NULL,
    PRIMARY KEY (workspace_id, operation_key)
);

ALTER TABLE public.mcp_gateway_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_gateway_receipts FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON TABLE public.mcp_gateway_receipts TO app_be;

-- The dedicated backend principal must be active, including when a caller has
-- inherited app_be's table privileges through another database role.
CREATE POLICY mcp_gateway_receipts_app_be_insert ON public.mcp_gateway_receipts
    FOR INSERT TO app_be WITH CHECK (current_user = 'app_be');
CREATE POLICY mcp_gateway_receipts_app_be_select ON public.mcp_gateway_receipts
    FOR SELECT TO app_be USING (current_user = 'app_be');
CREATE POLICY mcp_gateway_receipts_app_be_update ON public.mcp_gateway_receipts
    FOR UPDATE TO app_be USING (current_user = 'app_be') WITH CHECK (current_user = 'app_be');

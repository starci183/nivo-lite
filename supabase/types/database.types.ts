// migrations-sha256: e47465afb6fd441715bb37ad105741301e468e3b50c01b6e7a5c76817df42566

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounting_adjustments": {
                  Row: {
                    "corrected_amount_vnd": number | null,"created_at": string,"created_by": string,"created_by_user": string | null,"id": string,"note": string,"target_id": string,"target_type": string,"workspace_id": string
                  }
                  Insert: {
                    "corrected_amount_vnd"?: number | null,"created_at"?: string,"created_by": string,"created_by_user"?: string | null,"id"?: string,"note": string,"target_id": string,"target_type": string,"workspace_id": string
                  }
                  Update: {
                    "corrected_amount_vnd"?: number | null,"created_at"?: string,"created_by"?: string,"created_by_user"?: string | null,"id"?: string,"note"?: string,"target_id"?: string,"target_type"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounting_adjustments_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_access_log": {
                  Row: {
                    "after_access": string | null,"agent_id": string | null,"agent_name": string,"before_access": string | null,"changed_by": string | null,"changed_by_name": string,"connection_id": string | null,"connection_name": string,"created_at": string,"id": string,"workspace_id": string
                  }
                  Insert: {
                    "after_access"?: string | null,"agent_id"?: string | null,"agent_name"?: string,"before_access"?: string | null,"changed_by"?: string | null,"changed_by_name"?: string,"connection_id"?: string | null,"connection_name"?: string,"created_at"?: string,"id"?: string,"workspace_id": string
                  }
                  Update: {
                    "after_access"?: string | null,"agent_id"?: string | null,"agent_name"?: string,"before_access"?: string | null,"changed_by"?: string | null,"changed_by_name"?: string,"connection_id"?: string | null,"connection_name"?: string,"created_at"?: string,"id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_access_log_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_access_log_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_access_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_connections": {
                  Row: {
                    "access": string,"agent_id": string,"connection_id": string,"created_at": string,"purpose": string,"workspace_id": string
                  }
                  Insert: {
                    "access"?: string,"agent_id": string,"connection_id": string,"created_at"?: string,"purpose"?: string,"workspace_id": string
                  }
                  Update: {
                    "access"?: string,"agent_id"?: string,"connection_id"?: string,"created_at"?: string,"purpose"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_connections_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_connections_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_connections_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_conversations": {
                  Row: {
                    "agent_id": string,"channel": string,"connection_id": string | null,"created_at": string,"external_id": string | null,"handled_at": string | null,"handled_by": string | null,"id": string,"installation_id": string | null,"kind": string,"lead_id": string | null,"visitor_name": string | null,"workspace_id": string
                  }
                  Insert: {
                    "agent_id": string,"channel"?: string,"connection_id"?: string | null,"created_at"?: string,"external_id"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"installation_id"?: string | null,"kind": string,"lead_id"?: string | null,"visitor_name"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "agent_id"?: string,"channel"?: string,"connection_id"?: string | null,"created_at"?: string,"external_id"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"installation_id"?: string | null,"kind"?: string,"lead_id"?: string | null,"visitor_name"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_conversations_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_conversations_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_conversations_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_conversations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_messages": {
                  Row: {
                    "author_kind": string | null,"author_name": string | null,"body": string,"conversation_id": string,"created_at": string,"delivery_error": string | null,"delivery_status": string | null,"id": string,"in_reply_to": string | null,"role": string,"workspace_id": string
                  }
                  Insert: {
                    "author_kind"?: string | null,"author_name"?: string | null,"body": string,"conversation_id": string,"created_at"?: string,"delivery_error"?: string | null,"delivery_status"?: string | null,"id"?: string,"in_reply_to"?: string | null,"role": string,"workspace_id": string
                  }
                  Update: {
                    "author_kind"?: string | null,"author_name"?: string | null,"body"?: string,"conversation_id"?: string,"created_at"?: string,"delivery_error"?: string | null,"delivery_status"?: string | null,"id"?: string,"in_reply_to"?: string | null,"role"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "agent_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_messages_in_reply_to_fkey"
      columns: ["in_reply_to"]
isOneToOne: false
      referencedRelation: "agent_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_messages_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agents": {
                  Row: {
                    "approval_rule": string,"created_at": string,"greeting": string,"handle": string,"id": string,"instructions": string,"knowledge": string,"module": string,"name": string,"role": string,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "approval_rule"?: string,"created_at"?: string,"greeting"?: string,"handle": string,"id"?: string,"instructions": string,"knowledge"?: string,"module"?: string,"name": string,"role": string,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "approval_rule"?: string,"created_at"?: string,"greeting"?: string,"handle"?: string,"id"?: string,"instructions"?: string,"knowledge"?: string,"module"?: string,"name"?: string,"role"?: string,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agents_module_fk"
      columns: ["module"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "agents_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_generations": {
                  Row: {
                    "created_at": string,"error": string | null,"finished_at": string | null,"id": string,"input": NonNullable<Json>,"module": string,"output": Json | null,"purpose": string,"status": string,"timings": NonNullable<Json>,"usage": Json | null,"usage_kind": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"module"?: string,"output"?: Json | null,"purpose": string,"status"?: string,"timings"?: NonNullable<Json>,"usage"?: Json | null,"usage_kind"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"module"?: string,"output"?: Json | null,"purpose"?: string,"status"?: string,"timings"?: NonNullable<Json>,"usage"?: Json | null,"usage_kind"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_generations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_quota_overrides": {
                  Row: {
                    "credits_limit": number | null,"fallback_reply": string | null,"messages_limit": number | null,"note": string | null,"tokens_limit": number | null,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "credits_limit"?: number | null,"fallback_reply"?: string | null,"messages_limit"?: number | null,"note"?: string | null,"tokens_limit"?: number | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "credits_limit"?: number | null,"fallback_reply"?: string | null,"messages_limit"?: number | null,"note"?: string | null,"tokens_limit"?: number | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_quota_overrides_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage_events": {
                  Row: {
                    "completion_tokens": number,"cost_usd": number,"created_at": string,"estimated": boolean,"id": string,"kind": string,"model": string,"module": string,"prompt_tokens": number,"workspace_id": string
                  }
                  Insert: {
                    "completion_tokens"?: number,"cost_usd"?: number,"created_at"?: string,"estimated"?: boolean,"id"?: string,"kind": string,"model"?: string,"module"?: string,"prompt_tokens"?: number,"workspace_id": string
                  }
                  Update: {
                    "completion_tokens"?: number,"cost_usd"?: number,"created_at"?: string,"estimated"?: boolean,"id"?: string,"kind"?: string,"model"?: string,"module"?: string,"prompt_tokens"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage_notices": {
                  Row: {
                    "created_at": string,"level": string,"period": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"level": string,"period": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"level"?: string,"period"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_notices_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"api_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"key_hash": string,"key_prefix": string,"last_used_at": string | null,"name": string,"revoked_at": string | null,"scopes": (string)[],"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash": string,"key_prefix": string,"last_used_at"?: string | null,"name": string,"revoked_at"?: string | null,"scopes"?: (string)[],"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash"?: string,"key_prefix"?: string,"last_used_at"?: string | null,"name"?: string,"revoked_at"?: string | null,"scopes"?: (string)[],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_api_keys_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"api_rate_limits": {
                  Row: {
                    "hits": number,"key_id": string,"window_start": string
                  }
                  Insert: {
                    "hits"?: number,"key_id": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_rate_limits_key_id_fkey"
      columns: ["key_id"]
isOneToOne: false
      referencedRelation: "api_keys"
      referencedColumns: ["id"]
    }
                  ]
                },"app_commands": {
                  Row: {
                    "created_at": string,"error_code": string | null,"finished_at": string | null,"id": string,"input": NonNullable<Json>,"kind": string,"requested_by": string,"result": Json | null,"state": string,"workspace_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"error_code"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"kind": string,"requested_by": string,"result"?: Json | null,"state"?: string,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"error_code"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: NonNullable<Json>,"kind"?: string,"requested_by"?: string,"result"?: Json | null,"state"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_commands_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"app_errors": {
                  Row: {
                    "created_at": string,"ctx": NonNullable<Json>,"id": string,"message": string,"scope": string,"stack": string | null,"workspace_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"ctx"?: NonNullable<Json>,"id"?: string,"message": string,"scope": string,"stack"?: string | null,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"ctx"?: NonNullable<Json>,"id"?: string,"message"?: string,"scope"?: string,"stack"?: string | null,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_errors_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"authority": {
                  Row: {
                    "brand_voice": string,"demo_seeded_at": string | null,"goal_first_reply_minutes": number | null,"goal_new_customers": number | null,"goal_note": string,"goal_revenue_vnd": number | null,"limits_note": string,"policies": string,"reply_style": string,"updated_at": string,"updated_by": string | null,"workspace_id": string
                  }
                  Insert: {
                    "brand_voice"?: string,"demo_seeded_at"?: string | null,"goal_first_reply_minutes"?: number | null,"goal_new_customers"?: number | null,"goal_note"?: string,"goal_revenue_vnd"?: number | null,"limits_note"?: string,"policies"?: string,"reply_style"?: string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "brand_voice"?: string,"demo_seeded_at"?: string | null,"goal_first_reply_minutes"?: number | null,"goal_new_customers"?: number | null,"goal_note"?: string,"goal_revenue_vnd"?: number | null,"limits_note"?: string,"policies"?: string,"reply_style"?: string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "authority_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"authority_actions": {
                  Row: {
                    "action": string,"amount_limit": boolean,"default_limit_vnd": number | null,"default_mode": string,"default_required_fields": (string)[],"label": NonNullable<Json>,"max_mode": string | null,"module_key": string,"sort_order": number
                  }
                  Insert: {
                    "action": string,"amount_limit"?: boolean,"default_limit_vnd"?: number | null,"default_mode"?: string,"default_required_fields"?: (string)[],"label"?: NonNullable<Json>,"max_mode"?: string | null,"module_key": string,"sort_order"?: number
                  }
                  Update: {
                    "action"?: string,"amount_limit"?: boolean,"default_limit_vnd"?: number | null,"default_mode"?: string,"default_required_fields"?: (string)[],"label"?: NonNullable<Json>,"max_mode"?: string | null,"module_key"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "authority_actions_module_key_fkey"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    }
                  ]
                },"authority_rules": {
                  Row: {
                    "action": string,"department": string,"id": string,"limit_vnd": number | null,"mode": string,"note": string,"required_fields": (string)[],"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "action": string,"department": string,"id"?: string,"limit_vnd"?: number | null,"mode"?: string,"note"?: string,"required_fields"?: (string)[],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"department"?: string,"id"?: string,"limit_vnd"?: number | null,"mode"?: string,"note"?: string,"required_fields"?: (string)[],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "authority_rules_action_fk"
      columns: ["department","action"]
isOneToOne: false
      referencedRelation: "authority_actions"
      referencedColumns: ["module_key","action"]
    },{
      foreignKeyName: "authority_rules_department_fk"
      columns: ["department"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "authority_rules_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"automation_pipelines": {
                  Row: {
                    "approval_streak": number,"auto_send": boolean,"based_on_context": number | null,"body": string | null,"body_version": number,"config": NonNullable<Json>,"created_at": string,"created_by": string | null,"dismissed": boolean,"enabled": boolean,"id": string,"module_key": string | null,"name": string,"template_key": string,"template_version": number,"trust_offered_at": string | null,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "approval_streak"?: number,"auto_send"?: boolean,"based_on_context"?: number | null,"body"?: string | null,"body_version"?: number,"config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"dismissed"?: boolean,"enabled"?: boolean,"id"?: string,"module_key"?: string | null,"name": string,"template_key": string,"template_version"?: number,"trust_offered_at"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "approval_streak"?: number,"auto_send"?: boolean,"based_on_context"?: number | null,"body"?: string | null,"body_version"?: number,"config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"dismissed"?: boolean,"enabled"?: boolean,"id"?: string,"module_key"?: string | null,"name"?: string,"template_key"?: string,"template_version"?: number,"trust_offered_at"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_pipelines_module_key_fk"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "automation_pipelines_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"automation_runs": {
                  Row: {
                    "attempts": number,"created_at": string,"dedupe_key": string,"error": string | null,"evidence": string | null,"finished_at": string | null,"id": string,"payload": NonNullable<Json>,"pipeline_id": string,"run_at": string,"status": string,"steps": NonNullable<Json>,"trigger_ref": string,"workspace_id": string
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key": string,"error"?: string | null,"evidence"?: string | null,"finished_at"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"pipeline_id": string,"run_at"?: string,"status"?: string,"steps"?: NonNullable<Json>,"trigger_ref"?: string,"workspace_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string,"error"?: string | null,"evidence"?: string | null,"finished_at"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"pipeline_id"?: string,"run_at"?: string,"status"?: string,"steps"?: NonNullable<Json>,"trigger_ref"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_runs_pipeline_id_fkey"
      columns: ["pipeline_id"]
isOneToOne: false
      referencedRelation: "automation_pipelines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "automation_runs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"automation_templates": {
                  Row: {
                    "definition": NonNullable<Json>,"executor": string,"key": string,"module_key": string | null,"pack": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "definition": NonNullable<Json>,"executor"?: string,"key": string,"module_key"?: string | null,"pack"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "definition"?: NonNullable<Json>,"executor"?: string,"key"?: string,"module_key"?: string | null,"pack"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"billing_events": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"id": string,"kind": string,"workspace_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"kind": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"kind"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_exceptions": {
                  Row: {
                    "closed": boolean,"end_time": string | null,"id": string,"note": string,"on_date": string,"resource_id": string | null,"start_time": string | null,"workspace_id": string
                  }
                  Insert: {
                    "closed"?: boolean,"end_time"?: string | null,"id"?: string,"note"?: string,"on_date": string,"resource_id"?: string | null,"start_time"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "closed"?: boolean,"end_time"?: string | null,"id"?: string,"note"?: string,"on_date"?: string,"resource_id"?: string | null,"start_time"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_exceptions_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "booking_resources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_exceptions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_hours": {
                  Row: {
                    "end_time": string,"id": string,"resource_id": string,"start_time": string,"weekday": number,"workspace_id": string
                  }
                  Insert: {
                    "end_time": string,"id"?: string,"resource_id": string,"start_time": string,"weekday": number,"workspace_id": string
                  }
                  Update: {
                    "end_time"?: string,"id"?: string,"resource_id"?: string,"start_time"?: string,"weekday"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_hours_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "booking_resources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_hours_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_rate": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  Insert: {
                    "hits"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"booking_reminders": {
                  Row: {
                    "booking_id": string,"created_at": string,"due_at": string,"id": string,"kind": string,"note": string,"sent_at": string | null,"status": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "booking_id": string,"created_at"?: string,"due_at": string,"id"?: string,"kind": string,"note"?: string,"sent_at"?: string | null,"status"?: string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"due_at"?: string,"id"?: string,"kind"?: string,"note"?: string,"sent_at"?: string | null,"status"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_reminders_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_reminders_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_reminders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_resources": {
                  Row: {
                    "active": boolean,"capacity": number,"color": string,"created_at": string,"id": string,"kind": string,"name": string,"sort_order": number,"staff_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"capacity"?: number,"color"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"name": string,"sort_order"?: number,"staff_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"capacity"?: number,"color"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"sort_order"?: number,"staff_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_resources_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_resources_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_services": {
                  Row: {
                    "active": boolean,"buffer_min": number,"created_at": string,"description": string,"duration_min": number,"followup_days": number | null,"id": string,"name": string,"price_vnd": number | null,"resource_kind": string | null,"sort_order": number,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"buffer_min"?: number,"created_at"?: string,"description"?: string,"duration_min": number,"followup_days"?: number | null,"id"?: string,"name": string,"price_vnd"?: number | null,"resource_kind"?: string | null,"sort_order"?: number,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"buffer_min"?: number,"created_at"?: string,"description"?: string,"duration_min"?: number,"followup_days"?: number | null,"id"?: string,"name"?: string,"price_vnd"?: number | null,"resource_kind"?: string | null,"sort_order"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_services_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_settings": {
                  Row: {
                    "address": string,"auto_confirm": boolean,"cancel_window_hours": number,"deposit_pct": number,"handoff_order": boolean,"late_cancel_fee_pct": number,"max_advance_days": number,"min_lead_min": number,"no_show_fee_vnd": number,"public_enabled": boolean,"public_note": string,"public_slug": string | null,"reminder_hours": (number)[],"slot_step_min": number,"timezone": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "address"?: string,"auto_confirm"?: boolean,"cancel_window_hours"?: number,"deposit_pct"?: number,"handoff_order"?: boolean,"late_cancel_fee_pct"?: number,"max_advance_days"?: number,"min_lead_min"?: number,"no_show_fee_vnd"?: number,"public_enabled"?: boolean,"public_note"?: string,"public_slug"?: string | null,"reminder_hours"?: (number)[],"slot_step_min"?: number,"timezone"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "address"?: string,"auto_confirm"?: boolean,"cancel_window_hours"?: number,"deposit_pct"?: number,"handoff_order"?: boolean,"late_cancel_fee_pct"?: number,"max_advance_days"?: number,"min_lead_min"?: number,"no_show_fee_vnd"?: number,"public_enabled"?: boolean,"public_note"?: string,"public_slug"?: string | null,"reminder_hours"?: (number)[],"slot_step_min"?: number,"timezone"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_waitlist": {
                  Row: {
                    "conversation_id": string | null,"created_at": string,"customer_name": string,"customer_phone": string | null,"id": string,"lead_id": string | null,"note": string,"notified_at": string | null,"party_size": number,"resource_id": string | null,"service_id": string,"status": string,"window_end": string,"window_start": string,"workspace_id": string
                  }
                  Insert: {
                    "conversation_id"?: string | null,"created_at"?: string,"customer_name"?: string,"customer_phone"?: string | null,"id"?: string,"lead_id"?: string | null,"note"?: string,"notified_at"?: string | null,"party_size"?: number,"resource_id"?: string | null,"service_id": string,"status"?: string,"window_end": string,"window_start": string,"workspace_id": string
                  }
                  Update: {
                    "conversation_id"?: string | null,"created_at"?: string,"customer_name"?: string,"customer_phone"?: string | null,"id"?: string,"lead_id"?: string | null,"note"?: string,"notified_at"?: string | null,"party_size"?: number,"resource_id"?: string | null,"service_id"?: string,"status"?: string,"window_end"?: string,"window_start"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_waitlist_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "agent_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_waitlist_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_waitlist_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "booking_resources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_waitlist_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "booking_services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_waitlist_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "block_end_at": string,"cancel_fee_vnd": number,"cancel_reason": string | null,"cancelled_at": string | null,"checked_in_at": string | null,"conflict_note": string,"conversation_id": string | null,"created_at": string,"customer_email": string | null,"customer_name": string,"customer_phone": string | null,"deposit_status": string,"deposit_vnd": number,"done_at": string | null,"end_at": string,"holds_slot": boolean,"id": string,"idempotency_key": string | null,"installation_id": string | null,"lead_id": string | null,"note": string,"order_id": string | null,"origin": string,"party_size": number,"price_vnd": number | null,"reschedule_count": number,"rescheduled_from": string | null,"resource_id": string,"service_id": string,"source_channel": string,"start_at": string,"status": string,"updated_at": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "block_end_at": string,"cancel_fee_vnd"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"checked_in_at"?: string | null,"conflict_note"?: string,"conversation_id"?: string | null,"created_at"?: string,"customer_email"?: string | null,"customer_name"?: string,"customer_phone"?: string | null,"deposit_status"?: string,"deposit_vnd"?: number,"done_at"?: string | null,"end_at": string,"holds_slot"?: boolean,"id"?: string,"idempotency_key"?: string | null,"installation_id"?: string | null,"lead_id"?: string | null,"note"?: string,"order_id"?: string | null,"origin"?: string,"party_size"?: number,"price_vnd"?: number | null,"reschedule_count"?: number,"rescheduled_from"?: string | null,"resource_id": string,"service_id": string,"source_channel"?: string,"start_at": string,"status"?: string,"updated_at"?: string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "block_end_at"?: string,"cancel_fee_vnd"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"checked_in_at"?: string | null,"conflict_note"?: string,"conversation_id"?: string | null,"created_at"?: string,"customer_email"?: string | null,"customer_name"?: string,"customer_phone"?: string | null,"deposit_status"?: string,"deposit_vnd"?: number,"done_at"?: string | null,"end_at"?: string,"holds_slot"?: boolean,"id"?: string,"idempotency_key"?: string | null,"installation_id"?: string | null,"lead_id"?: string | null,"note"?: string,"order_id"?: string | null,"origin"?: string,"party_size"?: number,"price_vnd"?: number | null,"reschedule_count"?: number,"rescheduled_from"?: string | null,"resource_id"?: string,"service_id"?: string,"source_channel"?: string,"start_at"?: string,"status"?: string,"updated_at"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "agent_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "booking_resources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "booking_services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"brain_eval_cases": {
                  Row: {
                    "created_at": string,"expected": NonNullable<Json>,"id": string,"input": NonNullable<Json>,"kind": string,"module": string | null,"origin_ref": string | null,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"expected": NonNullable<Json>,"id"?: string,"input": NonNullable<Json>,"kind": string,"module"?: string | null,"origin_ref"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"expected"?: NonNullable<Json>,"id"?: string,"input"?: NonNullable<Json>,"kind"?: string,"module"?: string | null,"origin_ref"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brain_eval_cases_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"brain_extractions": {
                  Row: {
                    "attempts": number,"content_hash": string | null,"error": string | null,"facts_proposed": number,"model": string | null,"orphan_fact_ids": (string)[],"prompt_version": number,"source_id": string,"status": string,"updated_at": string,"windows_done": number,"windows_total": number,"workspace_id": string
                  }
                  Insert: {
                    "attempts"?: number,"content_hash"?: string | null,"error"?: string | null,"facts_proposed"?: number,"model"?: string | null,"orphan_fact_ids"?: (string)[],"prompt_version": number,"source_id": string,"status"?: string,"updated_at"?: string,"windows_done"?: number,"windows_total"?: number,"workspace_id": string
                  }
                  Update: {
                    "attempts"?: number,"content_hash"?: string | null,"error"?: string | null,"facts_proposed"?: number,"model"?: string | null,"orphan_fact_ids"?: (string)[],"prompt_version"?: number,"source_id"?: string,"status"?: string,"updated_at"?: string,"windows_done"?: number,"windows_total"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brain_extractions_source_id_fkey"
      columns: ["source_id"]
isOneToOne: true
      referencedRelation: "knowledge_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brain_extractions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"brain_facts": {
                  Row: {
                    "attribute": string,"attribute_label": string,"conflict_with": string | null,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"evidence": NonNullable<Json>,"id": string,"installation_id": string | null,"modules": (string)[],"proposal_kind": string,"proposed_at": string,"proposed_by": string,"scope": string,"source_kind": string,"status": string,"subject_key": string,"subject_label": string,"subject_type": string,"supersedes_id": string | null,"trust": number,"unit": string | null,"updated_at": string,"valid_from": string | null,"valid_to": string | null,"value": string,"value_number": number | null,"workspace_id": string
                  }
                  Insert: {
                    "attribute": string,"attribute_label": string,"conflict_with"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"evidence"?: NonNullable<Json>,"id"?: string,"installation_id"?: string | null,"modules"?: (string)[],"proposal_kind"?: string,"proposed_at"?: string,"proposed_by": string,"scope"?: string,"source_kind": string,"status"?: string,"subject_key": string,"subject_label": string,"subject_type"?: string,"supersedes_id"?: string | null,"trust": number,"unit"?: string | null,"updated_at"?: string,"valid_from"?: string | null,"valid_to"?: string | null,"value": string,"value_number"?: number | null,"workspace_id": string
                  }
                  Update: {
                    "attribute"?: string,"attribute_label"?: string,"conflict_with"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"evidence"?: NonNullable<Json>,"id"?: string,"installation_id"?: string | null,"modules"?: (string)[],"proposal_kind"?: string,"proposed_at"?: string,"proposed_by"?: string,"scope"?: string,"source_kind"?: string,"status"?: string,"subject_key"?: string,"subject_label"?: string,"subject_type"?: string,"supersedes_id"?: string | null,"trust"?: number,"unit"?: string | null,"updated_at"?: string,"valid_from"?: string | null,"valid_to"?: string | null,"value"?: string,"value_number"?: number | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brain_facts_conflict_with_fkey"
      columns: ["conflict_with"]
isOneToOne: false
      referencedRelation: "brain_facts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brain_facts_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brain_facts_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "brain_facts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brain_facts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"brain_lessons": {
                  Row: {
                    "applies_when": string,"body": string,"decided_at": string | null,"decided_by": string | null,"evidence": NonNullable<Json>,"id": string,"module": string | null,"origin": string,"proposed_at": string,"proposed_by": string,"status": string,"supersedes_id": string | null,"title": string,"version": number,"workspace_id": string
                  }
                  Insert: {
                    "applies_when"?: string,"body": string,"decided_at"?: string | null,"decided_by"?: string | null,"evidence"?: NonNullable<Json>,"id"?: string,"module"?: string | null,"origin"?: string,"proposed_at"?: string,"proposed_by": string,"status"?: string,"supersedes_id"?: string | null,"title": string,"version"?: number,"workspace_id": string
                  }
                  Update: {
                    "applies_when"?: string,"body"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"evidence"?: NonNullable<Json>,"id"?: string,"module"?: string | null,"origin"?: string,"proposed_at"?: string,"proposed_by"?: string,"status"?: string,"supersedes_id"?: string | null,"title"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brain_lessons_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "brain_lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brain_lessons_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"brain_source_profiles": {
                  Row: {
                    "confirmed_at": string | null,"confirmed_by": string | null,"connection_id": string,"entity": string,"field_map": NonNullable<Json>,"id": string,"notes": string,"sample": NonNullable<Json>,"status": string,"trust": number,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "confirmed_at"?: string | null,"confirmed_by"?: string | null,"connection_id": string,"entity": string,"field_map"?: NonNullable<Json>,"id"?: string,"notes"?: string,"sample"?: NonNullable<Json>,"status"?: string,"trust"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "confirmed_at"?: string | null,"confirmed_by"?: string | null,"connection_id"?: string,"entity"?: string,"field_map"?: NonNullable<Json>,"id"?: string,"notes"?: string,"sample"?: NonNullable<Json>,"status"?: string,"trust"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "brain_source_profiles_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "brain_source_profiles_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_receipts": {
                  Row: {
                    "channel": string,"created_at": string,"receipt_id": string,"workspace_id": string
                  }
                  Insert: {
                    "channel": string,"created_at"?: string,"receipt_id": string,"workspace_id": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"receipt_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_receipts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_secrets": {
                  Row: {
                    "ciphertext": string,"connection_id": string,"refresh_lock_until": string | null,"token_expires_at": string | null,"webhook_secret": string
                  }
                  Insert: {
                    "ciphertext": string,"connection_id": string,"refresh_lock_until"?: string | null,"token_expires_at"?: string | null,"webhook_secret": string
                  }
                  Update: {
                    "ciphertext"?: string,"connection_id"?: string,"refresh_lock_until"?: string | null,"token_expires_at"?: string | null,"webhook_secret"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_secrets_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: true
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"connections": {
                  Row: {
                    "created_at": string,"created_by": string | null,"environment": string,"first_event": Json | null,"id": string,"is_default": boolean,"last_error": string | null,"last_event_at": string | null,"last_sync_at": string | null,"name": string,"next_sync_at": string | null,"provider": string,"public_meta": NonNullable<Json>,"status": string,"sync_every_minutes": number | null,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"environment"?: string,"first_event"?: Json | null,"id"?: string,"is_default"?: boolean,"last_error"?: string | null,"last_event_at"?: string | null,"last_sync_at"?: string | null,"name": string,"next_sync_at"?: string | null,"provider": string,"public_meta"?: NonNullable<Json>,"status"?: string,"sync_every_minutes"?: number | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"environment"?: string,"first_event"?: Json | null,"id"?: string,"is_default"?: boolean,"last_error"?: string | null,"last_event_at"?: string | null,"last_sync_at"?: string | null,"name"?: string,"next_sync_at"?: string | null,"provider"?: string,"public_meta"?: NonNullable<Json>,"status"?: string,"sync_every_minutes"?: number | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connections_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"connector_interest": {
                  Row: {
                    "connector_id": string,"created_at": string,"user_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "connector_id": string,"created_at"?: string,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "connector_id"?: string,"created_at"?: string,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connector_interest_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"content_cadence": {
                  Row: {
                    "channel": string,"created_at": string,"days": (number)[],"id": string,"post_time": string,"posts_per_week": number,"workspace_id": string
                  }
                  Insert: {
                    "channel": string,"created_at"?: string,"days"?: (number)[],"id"?: string,"post_time"?: string,"posts_per_week"?: number,"workspace_id": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"days"?: (number)[],"id"?: string,"post_time"?: string,"posts_per_week"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_cadence_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"content_items": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"brief": string,"channels": (string)[],"created_at": string,"created_by": string,"drafted_at": string | null,"evidence": NonNullable<Json>,"hashtags": (string)[],"holiday_key": string | null,"id": string,"links": NonNullable<Json>,"media": NonNullable<Json>,"pillar_id": string | null,"plan_id": string | null,"published": NonNullable<Json>,"published_at": string | null,"scheduled_at": string | null,"source": string,"status": string,"title": string,"updated_at": string,"variants": NonNullable<Json>,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"brief"?: string,"channels"?: (string)[],"created_at"?: string,"created_by"?: string,"drafted_at"?: string | null,"evidence"?: NonNullable<Json>,"hashtags"?: (string)[],"holiday_key"?: string | null,"id"?: string,"links"?: NonNullable<Json>,"media"?: NonNullable<Json>,"pillar_id"?: string | null,"plan_id"?: string | null,"published"?: NonNullable<Json>,"published_at"?: string | null,"scheduled_at"?: string | null,"source"?: string,"status"?: string,"title": string,"updated_at"?: string,"variants"?: NonNullable<Json>,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"brief"?: string,"channels"?: (string)[],"created_at"?: string,"created_by"?: string,"drafted_at"?: string | null,"evidence"?: NonNullable<Json>,"hashtags"?: (string)[],"holiday_key"?: string | null,"id"?: string,"links"?: NonNullable<Json>,"media"?: NonNullable<Json>,"pillar_id"?: string | null,"plan_id"?: string | null,"published"?: NonNullable<Json>,"published_at"?: string | null,"scheduled_at"?: string | null,"source"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"variants"?: NonNullable<Json>,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_items_pillar_id_fkey"
      columns: ["pillar_id"]
isOneToOne: false
      referencedRelation: "content_pillars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_items_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "content_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_items_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"content_pillars": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string,"id": string,"name": string,"sort": number,"weight": number,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"id"?: string,"name": string,"sort"?: number,"weight"?: number,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string,"id"?: string,"name"?: string,"sort"?: number,"weight"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_pillars_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"content_plans": {
                  Row: {
                    "ai_ms": number | null,"created_at": string,"created_by": string,"id": string,"idea_count": number,"meta": NonNullable<Json>,"month": string,"note": string | null,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "ai_ms"?: number | null,"created_at"?: string,"created_by"?: string,"id"?: string,"idea_count"?: number,"meta"?: NonNullable<Json>,"month": string,"note"?: string | null,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "ai_ms"?: number | null,"created_at"?: string,"created_by"?: string,"id"?: string,"idea_count"?: number,"meta"?: NonNullable<Json>,"month"?: string,"note"?: string | null,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_plans_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"content_settings": {
                  Row: {
                    "automations": NonNullable<Json>,"avoid": string,"brand_voice": string,"cta": string,"hashtags": (string)[],"marks": NonNullable<Json>,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "automations"?: NonNullable<Json>,"avoid"?: string,"brand_voice"?: string,"cta"?: string,"hashtags"?: (string)[],"marks"?: NonNullable<Json>,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "automations"?: NonNullable<Json>,"avoid"?: string,"brand_voice"?: string,"cta"?: string,"hashtags"?: (string)[],"marks"?: NonNullable<Json>,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "amount_vnd": number | null,"created_at": string,"customer_name": string,"ends_on": string,"id": string,"lead_id": string | null,"note": string,"plan": string,"starts_on": string,"status": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "amount_vnd"?: number | null,"created_at"?: string,"customer_name": string,"ends_on": string,"id"?: string,"lead_id"?: string | null,"note"?: string,"plan"?: string,"starts_on": string,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount_vnd"?: number | null,"created_at"?: string,"customer_name"?: string,"ends_on"?: string,"id"?: string,"lead_id"?: string | null,"note"?: string,"plan"?: string,"starts_on"?: string,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_packs": {
                  Row: {
                    "active": boolean,"code": string,"credits": number,"price_vnd": number,"sort": number
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"credits": number,"price_vnd": number,"sort"?: number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"credits"?: number,"price_vnd"?: number,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"credit_topup_draws": {
                  Row: {
                    "drawn": number,"period": string,"unfunded": number,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "drawn"?: number,"period": string,"unfunded"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "drawn"?: number,"period"?: string,"unfunded"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_topup_draws_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"credit_topups": {
                  Row: {
                    "credits": number,"credits_remaining": number,"expires_at": string,"id": string,"order_id": string,"pack_code": string | null,"price_vnd": number,"purchased_at": string,"workspace_id": string
                  }
                  Insert: {
                    "credits": number,"credits_remaining": number,"expires_at": string,"id"?: string,"order_id": string,"pack_code"?: string | null,"price_vnd": number,"purchased_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "credits"?: number,"credits_remaining"?: number,"expires_at"?: string,"id"?: string,"order_id"?: string,"pack_code"?: string | null,"price_vnd"?: number,"purchased_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_topups_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "payment_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "credit_topups_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"cron_targets": {
                  Row: {
                    "name": string,"secret": string,"updated_at": string,"url": string
                  }
                  Insert: {
                    "name": string,"secret": string,"updated_at"?: string,"url": string
                  }
                  Update: {
                    "name"?: string,"secret"?: string,"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"data_records": {
                  Row: {
                    "connection_id": string,"data": NonNullable<Json>,"entity": string,"external_id": string,"id": string,"occurred_at": string | null,"synced_at": string,"title": string,"workspace_id": string
                  }
                  Insert: {
                    "connection_id": string,"data"?: NonNullable<Json>,"entity": string,"external_id": string,"id"?: string,"occurred_at"?: string | null,"synced_at"?: string,"title"?: string,"workspace_id": string
                  }
                  Update: {
                    "connection_id"?: string,"data"?: NonNullable<Json>,"entity"?: string,"external_id"?: string,"id"?: string,"occurred_at"?: string | null,"synced_at"?: string,"title"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_records_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_records_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"data_sync_runs": {
                  Row: {
                    "connection_id": string,"error": string | null,"finished_at": string | null,"id": string,"rows_upserted": number,"started_at": string,"status": string,"trigger": string,"workspace_id": string
                  }
                  Insert: {
                    "connection_id": string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"rows_upserted"?: number,"started_at"?: string,"status"?: string,"trigger"?: string,"workspace_id": string
                  }
                  Update: {
                    "connection_id"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"rows_upserted"?: number,"started_at"?: string,"status"?: string,"trigger"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_sync_runs_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_sync_runs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"decisions": {
                  Row: {
                    "action": string,"after": Json | null,"before": Json | null,"created_at": string,"decided_by": string,"decider_kind": string,"department": string,"id": string,"lead_id": string | null,"note": string | null,"outcome": string,"reason": string | null,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "action": string,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"decided_by": string,"decider_kind": string,"department": string,"id"?: string,"lead_id"?: string | null,"note"?: string | null,"outcome": string,"reason"?: string | null,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"decided_by"?: string,"decider_kind"?: string,"department"?: string,"id"?: string,"lead_id"?: string | null,"note"?: string | null,"outcome"?: string,"reason"?: string | null,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "decisions_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisions_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"email_messages": {
                  Row: {
                    "connection_id": string | null,"created_at": string,"error": string | null,"id": string,"provider_message_id": string | null,"purpose": string,"refs": NonNullable<Json>,"status": string,"subject": string,"to_address": string,"via": string,"workspace_id": string
                  }
                  Insert: {
                    "connection_id"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"provider_message_id"?: string | null,"purpose"?: string,"refs"?: NonNullable<Json>,"status": string,"subject"?: string,"to_address": string,"via"?: string,"workspace_id": string
                  }
                  Update: {
                    "connection_id"?: string | null,"created_at"?: string,"error"?: string | null,"id"?: string,"provider_message_id"?: string | null,"purpose"?: string,"refs"?: NonNullable<Json>,"status"?: string,"subject"?: string,"to_address"?: string,"via"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_messages_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_messages_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"engine_jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"dedupe_key": string | null,"error": string | null,"finished_at": string | null,"id": string,"kind": string,"locked_by": string | null,"locked_until": string | null,"max_attempts": number,"payload": NonNullable<Json>,"result": Json | null,"run_at": string,"status": string,"workspace_id": string | null
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"kind": string,"locked_by"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"result"?: Json | null,"run_at"?: string,"status"?: string,"workspace_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"kind"?: string,"locked_by"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"result"?: Json | null,"run_at"?: string,"status"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "engine_jobs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"engine_workers": {
                  Row: {
                    "info": NonNullable<Json>,"kinds": (string)[],"last_heartbeat_at": string,"started_at": string,"version": string,"worker_id": string
                  }
                  Insert: {
                    "info"?: NonNullable<Json>,"kinds"?: (string)[],"last_heartbeat_at"?: string,"started_at"?: string,"version"?: string,"worker_id": string
                  }
                  Update: {
                    "info"?: NonNullable<Json>,"kinds"?: (string)[],"last_heartbeat_at"?: string,"started_at"?: string,"version"?: string,"worker_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "actor": string,"created_at": string,"evidence": string | null,"id": string,"kind": string,"lead_id": string | null,"summary": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "actor": string,"created_at"?: string,"evidence"?: string | null,"id"?: string,"kind": string,"lead_id"?: string | null,"summary": string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "actor"?: string,"created_at"?: string,"evidence"?: string | null,"id"?: string,"kind"?: string,"lead_id"?: string | null,"summary"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"executions": {
                  Row: {
                    "agent_id": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"draft": string,"id": string,"kind": string,"responsibility_id": string,"status": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "agent_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"draft": string,"id"?: string,"kind"?: string,"responsibility_id": string,"status"?: string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "agent_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"draft"?: string,"id"?: string,"kind"?: string,"responsibility_id"?: string,"status"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "executions_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "executions_responsibility_id_fkey"
      columns: ["responsibility_id"]
isOneToOne: false
      referencedRelation: "responsibilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "executions_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "executions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_apply_hits": {
                  Row: {
                    "created_at": string,"id": number,"ip_hash": string,"kind": string,"workspace_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"ip_hash": string,"kind"?: string,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"ip_hash"?: string,"kind"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"hiring_availability": {
                  Row: {
                    "end_min": number,"id": string,"member_user_id": string,"start_min": number,"weekday": number,"workspace_id": string
                  }
                  Insert: {
                    "end_min": number,"id"?: string,"member_user_id": string,"start_min": number,"weekday": number,"workspace_id": string
                  }
                  Update: {
                    "end_min"?: number,"id"?: string,"member_user_id"?: string,"start_min"?: number,"weekday"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_availability_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_candidates": {
                  Row: {
                    "answers": NonNullable<Json>,"availability": string,"conversation_id": string | null,"created_at": string,"cv_mime": string | null,"cv_name": string | null,"cv_path": string | null,"cv_size": number | null,"email": string,"id": string,"job_id": string,"name": string,"notes": string,"phone": string,"rejected_reason": string | null,"score": number | null,"score_label": string | null,"score_reasons": NonNullable<Json>,"score_summary": string | null,"screened_at": string | null,"source": string,"staff_id": string | null,"stage": string,"stage_changed_at": string,"workspace_id": string
                  }
                  Insert: {
                    "answers"?: NonNullable<Json>,"availability"?: string,"conversation_id"?: string | null,"created_at"?: string,"cv_mime"?: string | null,"cv_name"?: string | null,"cv_path"?: string | null,"cv_size"?: number | null,"email"?: string,"id"?: string,"job_id": string,"name": string,"notes"?: string,"phone"?: string,"rejected_reason"?: string | null,"score"?: number | null,"score_label"?: string | null,"score_reasons"?: NonNullable<Json>,"score_summary"?: string | null,"screened_at"?: string | null,"source"?: string,"staff_id"?: string | null,"stage"?: string,"stage_changed_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"availability"?: string,"conversation_id"?: string | null,"created_at"?: string,"cv_mime"?: string | null,"cv_name"?: string | null,"cv_path"?: string | null,"cv_size"?: number | null,"email"?: string,"id"?: string,"job_id"?: string,"name"?: string,"notes"?: string,"phone"?: string,"rejected_reason"?: string | null,"score"?: number | null,"score_label"?: string | null,"score_reasons"?: NonNullable<Json>,"score_summary"?: string | null,"screened_at"?: string | null,"source"?: string,"staff_id"?: string | null,"stage"?: string,"stage_changed_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_candidates_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "agent_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_candidates_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "hiring_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_candidates_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_consents": {
                  Row: {
                    "candidate_id": string,"channel": string,"consent_text": string,"given_at": string,"id": string,"ip_hash": string | null,"workspace_id": string
                  }
                  Insert: {
                    "candidate_id": string,"channel": string,"consent_text": string,"given_at"?: string,"id"?: string,"ip_hash"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "candidate_id"?: string,"channel"?: string,"consent_text"?: string,"given_at"?: string,"id"?: string,"ip_hash"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_consents_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "hiring_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_consents_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_events": {
                  Row: {
                    "actor": string,"candidate_id": string,"created_at": string,"id": string,"kind": string,"summary": string,"workspace_id": string
                  }
                  Insert: {
                    "actor": string,"candidate_id": string,"created_at"?: string,"id"?: string,"kind": string,"summary": string,"workspace_id": string
                  }
                  Update: {
                    "actor"?: string,"candidate_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"summary"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_events_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "hiring_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_interviews": {
                  Row: {
                    "candidate_id": string,"created_at": string,"duration_min": number,"id": string,"interviewer_name": string,"interviewer_user_id": string | null,"job_id": string,"location": string,"mode": string,"note": string,"proposed_slots": NonNullable<Json>,"reminder_sent_at": string | null,"slot_end": string | null,"slot_start": string | null,"status": string,"token": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"duration_min"?: number,"id"?: string,"interviewer_name"?: string,"interviewer_user_id"?: string | null,"job_id": string,"location"?: string,"mode"?: string,"note"?: string,"proposed_slots"?: NonNullable<Json>,"reminder_sent_at"?: string | null,"slot_end"?: string | null,"slot_start"?: string | null,"status"?: string,"token": string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"duration_min"?: number,"id"?: string,"interviewer_name"?: string,"interviewer_user_id"?: string | null,"job_id"?: string,"location"?: string,"mode"?: string,"note"?: string,"proposed_slots"?: NonNullable<Json>,"reminder_sent_at"?: string | null,"slot_end"?: string | null,"slot_start"?: string | null,"status"?: string,"token"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_interviews_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "hiring_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_interviews_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "hiring_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_interviews_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_interviews_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_jobs": {
                  Row: {
                    "ad_variants": Json | null,"channels": (string)[],"closes_at": string | null,"created_at": string,"created_by": string | null,"description": string,"employment_type": string,"headcount": number,"id": string,"location": string,"pay_max_vnd": number | null,"pay_min_vnd": number | null,"pay_unit": string,"position": string,"questions": NonNullable<Json>,"requirements": NonNullable<Json>,"schedule": string,"slug": string,"status": string,"title": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "ad_variants"?: Json | null,"channels"?: (string)[],"closes_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"employment_type"?: string,"headcount"?: number,"id"?: string,"location"?: string,"pay_max_vnd"?: number | null,"pay_min_vnd"?: number | null,"pay_unit"?: string,"position"?: string,"questions"?: NonNullable<Json>,"requirements"?: NonNullable<Json>,"schedule"?: string,"slug": string,"status"?: string,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ad_variants"?: Json | null,"channels"?: (string)[],"closes_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"employment_type"?: string,"headcount"?: number,"id"?: string,"location"?: string,"pay_max_vnd"?: number | null,"pay_min_vnd"?: number | null,"pay_unit"?: string,"position"?: string,"questions"?: NonNullable<Json>,"requirements"?: NonNullable<Json>,"schedule"?: string,"slug"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_jobs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_offers": {
                  Row: {
                    "candidate_id": string,"created_at": string,"created_by": string | null,"draft": string,"expires_at": string | null,"id": string,"job_id": string,"responded_at": string | null,"sent_at": string | null,"sent_via": string | null,"status": string,"terms": NonNullable<Json>,"token": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"created_by"?: string | null,"draft"?: string,"expires_at"?: string | null,"id"?: string,"job_id": string,"responded_at"?: string | null,"sent_at"?: string | null,"sent_via"?: string | null,"status"?: string,"terms"?: NonNullable<Json>,"token": string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"created_by"?: string | null,"draft"?: string,"expires_at"?: string | null,"id"?: string,"job_id"?: string,"responded_at"?: string | null,"sent_at"?: string | null,"sent_via"?: string | null,"status"?: string,"terms"?: NonNullable<Json>,"token"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_offers_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "hiring_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_offers_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "hiring_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_offers_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_offers_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_onboarding": {
                  Row: {
                    "candidate_id": string,"created_at": string,"done": boolean,"done_at": string | null,"id": string,"sort": number,"title": string,"workspace_id": string
                  }
                  Insert: {
                    "candidate_id": string,"created_at"?: string,"done"?: boolean,"done_at"?: string | null,"id"?: string,"sort"?: number,"title": string,"workspace_id": string
                  }
                  Update: {
                    "candidate_id"?: string,"created_at"?: string,"done"?: boolean,"done_at"?: string | null,"id"?: string,"sort"?: number,"title"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_onboarding_candidate_id_fkey"
      columns: ["candidate_id"]
isOneToOne: false
      referencedRelation: "hiring_candidates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hiring_onboarding_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_retention_log": {
                  Row: {
                    "deleted_candidates": number,"deleted_files": number,"id": string,"ran_at": string,"retention_days": number,"workspace_id": string
                  }
                  Insert: {
                    "deleted_candidates"?: number,"deleted_files"?: number,"id"?: string,"ran_at"?: string,"retention_days": number,"workspace_id": string
                  }
                  Update: {
                    "deleted_candidates"?: number,"deleted_files"?: number,"id"?: string,"ran_at"?: string,"retention_days"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_retention_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hiring_settings": {
                  Row: {
                    "ad_tone": string,"apply_consent_text": string,"auto_close_when_filled": boolean,"notify_new_candidate": boolean,"public_slug": string,"remind_interview": boolean,"retention_days": number,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "ad_tone"?: string,"apply_consent_text"?: string,"auto_close_when_filled"?: boolean,"notify_new_candidate"?: boolean,"public_slug": string,"remind_interview"?: boolean,"retention_days"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ad_tone"?: string,"apply_consent_text"?: string,"auto_close_when_filled"?: boolean,"notify_new_candidate"?: boolean,"public_slug"?: string,"remind_interview"?: boolean,"retention_days"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hiring_settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inbound_events": {
                  Row: {
                    "amount_vnd": number | null,"body": string,"channel": string,"created_at": string,"dedupe_key": string,"duplicate_count": number,"event_id": string | null,"external_ref": string | null,"id": string,"kind": string,"last_duplicate_at": string | null,"lead_id": string | null,"origin": string,"sender_contact": string | null,"sender_name": string | null,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "amount_vnd"?: number | null,"body"?: string,"channel": string,"created_at"?: string,"dedupe_key": string,"duplicate_count"?: number,"event_id"?: string | null,"external_ref"?: string | null,"id"?: string,"kind": string,"last_duplicate_at"?: string | null,"lead_id"?: string | null,"origin": string,"sender_contact"?: string | null,"sender_name"?: string | null,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount_vnd"?: number | null,"body"?: string,"channel"?: string,"created_at"?: string,"dedupe_key"?: string,"duplicate_count"?: number,"event_id"?: string | null,"external_ref"?: string | null,"id"?: string,"kind"?: string,"last_duplicate_at"?: string | null,"lead_id"?: string | null,"origin"?: string,"sender_contact"?: string | null,"sender_name"?: string | null,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbound_events_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbound_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "active": boolean,"aliases": (string)[],"category": string,"cost_vnd": number,"created_at": string,"id": string,"name": string,"reorder_point": number,"reorder_qty": number,"sell_price_vnd": number | null,"sku": string,"supplier_id": string | null,"unit": string,"units": NonNullable<Json>,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"aliases"?: (string)[],"category"?: string,"cost_vnd"?: number,"created_at"?: string,"id"?: string,"name": string,"reorder_point"?: number,"reorder_qty"?: number,"sell_price_vnd"?: number | null,"sku": string,"supplier_id"?: string | null,"unit"?: string,"units"?: NonNullable<Json>,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"aliases"?: (string)[],"category"?: string,"cost_vnd"?: number,"created_at"?: string,"id"?: string,"name"?: string,"reorder_point"?: number,"reorder_qty"?: number,"sell_price_vnd"?: number | null,"sku"?: string,"supplier_id"?: string | null,"unit"?: string,"units"?: NonNullable<Json>,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "inventory_suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_items_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_locations": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"name": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_locations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "by_name": string,"created_at": string,"dedupe_key": string | null,"evidence": string | null,"id": string,"item_id": string,"kind": string,"location_id": string,"qty": number,"qty_after": number,"reason": string,"ref_id": string | null,"ref_label": string | null,"ref_type": string,"unit_cost_vnd": number | null,"workspace_id": string
                  }
                  Insert: {
                    "by_name"?: string,"created_at"?: string,"dedupe_key"?: string | null,"evidence"?: string | null,"id"?: string,"item_id": string,"kind": string,"location_id": string,"qty": number,"qty_after": number,"reason"?: string,"ref_id"?: string | null,"ref_label"?: string | null,"ref_type"?: string,"unit_cost_vnd"?: number | null,"workspace_id": string
                  }
                  Update: {
                    "by_name"?: string,"created_at"?: string,"dedupe_key"?: string | null,"evidence"?: string | null,"id"?: string,"item_id"?: string,"kind"?: string,"location_id"?: string,"qty"?: number,"qty_after"?: number,"reason"?: string,"ref_id"?: string | null,"ref_label"?: string | null,"ref_type"?: string,"unit_cost_vnd"?: number | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_po_lines": {
                  Row: {
                    "id": string,"item_id": string,"po_id": string,"qty_ordered": number,"qty_received": number,"unit_cost_vnd": number,"workspace_id": string
                  }
                  Insert: {
                    "id"?: string,"item_id": string,"po_id": string,"qty_ordered": number,"qty_received"?: number,"unit_cost_vnd"?: number,"workspace_id": string
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"po_id"?: string,"qty_ordered"?: number,"qty_received"?: number,"unit_cost_vnd"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_po_lines_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_po_lines_po_id_fkey"
      columns: ["po_id"]
isOneToOne: false
      referencedRelation: "inventory_purchase_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_po_lines_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_purchase_orders": {
                  Row: {
                    "created_at": string,"created_by": string,"expected_at": string | null,"id": string,"message": string,"note": string,"po_no": string,"reminders": number,"send_note": string | null,"sent_at": string | null,"sent_via": string | null,"source": string,"status": string,"supplier_id": string | null,"total_vnd": number,"updated_at": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"expected_at"?: string | null,"id"?: string,"message"?: string,"note"?: string,"po_no": string,"reminders"?: number,"send_note"?: string | null,"sent_at"?: string | null,"sent_via"?: string | null,"source"?: string,"status"?: string,"supplier_id"?: string | null,"total_vnd"?: number,"updated_at"?: string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expected_at"?: string | null,"id"?: string,"message"?: string,"note"?: string,"po_no"?: string,"reminders"?: number,"send_note"?: string | null,"sent_at"?: string | null,"sent_via"?: string | null,"source"?: string,"status"?: string,"supplier_id"?: string | null,"total_vnd"?: number,"updated_at"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_purchase_orders_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "inventory_suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_purchase_orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_receipts": {
                  Row: {
                    "created_at": string,"id": string,"invoice_no": string | null,"note": string,"po_id": string,"received_by": string,"total_vnd": number,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"invoice_no"?: string | null,"note"?: string,"po_id": string,"received_by"?: string,"total_vnd"?: number,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invoice_no"?: string | null,"note"?: string,"po_id"?: string,"received_by"?: string,"total_vnd"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_receipts_po_id_fkey"
      columns: ["po_id"]
isOneToOne: false
      referencedRelation: "inventory_purchase_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_receipts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_recipe_lines": {
                  Row: {
                    "id": string,"item_id": string,"qty": number,"recipe_id": string,"workspace_id": string
                  }
                  Insert: {
                    "id"?: string,"item_id": string,"qty": number,"recipe_id": string,"workspace_id": string
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"qty"?: number,"recipe_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_recipe_lines_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_recipe_lines_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "inventory_recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_recipe_lines_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_recipes": {
                  Row: {
                    "active": boolean,"aliases": (string)[],"created_at": string,"id": string,"name": string,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"aliases"?: (string)[],"created_at"?: string,"id"?: string,"name": string,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"aliases"?: (string)[],"created_at"?: string,"id"?: string,"name"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_recipes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_stock_levels": {
                  Row: {
                    "item_id": string,"location_id": string,"qty": number,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "item_id": string,"location_id": string,"qty"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "item_id"?: string,"location_id"?: string,"qty"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_stock_levels_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_stock_levels_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "inventory_locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_stock_levels_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_suppliers": {
                  Row: {
                    "active": boolean,"channel": string,"contact_name": string,"created_at": string,"email": string | null,"id": string,"lead_time_days": number,"name": string,"note": string,"payment_terms": string,"phone": string | null,"workspace_id": string,"zalo": string | null
                  }
                  Insert: {
                    "active"?: boolean,"channel"?: string,"contact_name"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"lead_time_days"?: number,"name": string,"note"?: string,"payment_terms"?: string,"phone"?: string | null,"workspace_id": string,"zalo"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"channel"?: string,"contact_name"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"lead_time_days"?: number,"name"?: string,"note"?: string,"payment_terms"?: string,"phone"?: string | null,"workspace_id"?: string,"zalo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_suppliers_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_vnd": number,"created_at": string,"due_at": string | null,"id": string,"invoice_no": string,"issued_at": string | null,"issued_by": string | null,"lead_id": string | null,"order_id": string | null,"origin": string,"paid_at": string | null,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "amount_vnd": number,"created_at"?: string,"due_at"?: string | null,"id"?: string,"invoice_no": string,"issued_at"?: string | null,"issued_by"?: string | null,"lead_id"?: string | null,"order_id"?: string | null,"origin"?: string,"paid_at"?: string | null,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount_vnd"?: number,"created_at"?: string,"due_at"?: string | null,"id"?: string,"invoice_no"?: string,"issued_at"?: string | null,"issued_by"?: string | null,"lead_id"?: string | null,"order_id"?: string | null,"origin"?: string,"paid_at"?: string | null,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"job_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"dedupe_key": string,"finished_at": string | null,"id": string,"last_error": string | null,"msg_id": number | null,"name": string,"payload": NonNullable<Json>,"queue": string,"sent_at": string | null,"started_at": string | null,"state": string,"workspace_id": string | null
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key": string,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"msg_id"?: number | null,"name": string,"payload"?: NonNullable<Json>,"queue": string,"sent_at"?: string | null,"started_at"?: string | null,"state"?: string,"workspace_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"msg_id"?: number | null,"name"?: string,"payload"?: NonNullable<Json>,"queue"?: string,"sent_at"?: string | null,"started_at"?: string | null,"state"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_outbox_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"job_slots": {
                  Row: {
                    "lease_until": string,"msg_id": number,"queue": string,"workspace_id": string
                  }
                  Insert: {
                    "lease_until": string,"msg_id": number,"queue": string,"workspace_id": string
                  }
                  Update: {
                    "lease_until"?: string,"msg_id"?: number,"queue"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"jobs": {
                  Row: {
                    "claimed_by": string | null,"created_at": string,"current_step": string | null,"error": string | null,"fencing_token": number,"id": string,"job_key": string,"kind": string,"lease_expires_at": string | null,"payload": NonNullable<Json>,"status": string,"updated_at": string
                  }
                  Insert: {
                    "claimed_by"?: string | null,"created_at": string,"current_step"?: string | null,"error"?: string | null,"fencing_token": number,"id"?: string,"job_key": string,"kind": string,"lease_expires_at"?: string | null,"payload": NonNullable<Json>,"status": string,"updated_at": string
                  }
                  Update: {
                    "claimed_by"?: string | null,"created_at"?: string,"current_step"?: string | null,"error"?: string | null,"fencing_token"?: number,"id"?: string,"job_key"?: string,"kind"?: string,"lease_expires_at"?: string | null,"payload"?: NonNullable<Json>,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"knowledge_chunks": {
                  Row: {
                    "content": string,"created_at": string,"embedding": string | null,"embedding_model": string | null,"fts": unknown,"id": string,"module": string | null,"ord": number,"source_id": string,"visibility": string,"workspace_id": string
                  }
                  Insert: {
                    "content": string,"created_at"?: string,"embedding"?: string | null,"embedding_model"?: string | null,"fts"?: never,"id"?: string,"module"?: string | null,"ord": number,"source_id": string,"visibility"?: string,"workspace_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"embedding"?: string | null,"embedding_model"?: string | null,"fts"?: never,"id"?: string,"module"?: string | null,"ord"?: number,"source_id"?: string,"visibility"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_chunks_module_fk"
      columns: ["module"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "knowledge_chunks_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "knowledge_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_chunks_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"knowledge_gaps": {
                  Row: {
                    "answered_at": string | null,"answered_by": string | null,"attribute_guess": string | null,"count": number,"dismissed_at": string | null,"dismissed_by": string | null,"example_conversation_id": string | null,"first_seen_at": string,"id": string,"keywords": (string)[],"last_seen_at": string,"module": string,"question": string,"question_key": string,"reopened_count": number,"source": string,"status": string,"topic": string | null,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"attribute_guess"?: string | null,"count"?: number,"dismissed_at"?: string | null,"dismissed_by"?: string | null,"example_conversation_id"?: string | null,"first_seen_at"?: string,"id"?: string,"keywords"?: (string)[],"last_seen_at"?: string,"module": string,"question": string,"question_key": string,"reopened_count"?: number,"source"?: string,"status"?: string,"topic"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"attribute_guess"?: string | null,"count"?: number,"dismissed_at"?: string | null,"dismissed_by"?: string | null,"example_conversation_id"?: string | null,"first_seen_at"?: string,"id"?: string,"keywords"?: (string)[],"last_seen_at"?: string,"module"?: string,"question"?: string,"question_key"?: string,"reopened_count"?: number,"source"?: string,"status"?: string,"topic"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_gaps_example_conversation_id_fkey"
      columns: ["example_conversation_id"]
isOneToOne: false
      referencedRelation: "agent_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_gaps_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"knowledge_sources": {
                  Row: {
                    "chunk_count": number,"content": string,"created_at": string,"created_by": string | null,"error": string | null,"id": string,"installation_id": string | null,"kind": string,"module": string | null,"origin": string | null,"progress": number,"source_url": string | null,"status": string,"storage_path": string | null,"tags": (string)[],"title": string,"topic": string | null,"updated_at": string,"visibility": string,"workspace_id": string
                  }
                  Insert: {
                    "chunk_count"?: number,"content"?: string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"id"?: string,"installation_id"?: string | null,"kind": string,"module"?: string | null,"origin"?: string | null,"progress"?: number,"source_url"?: string | null,"status"?: string,"storage_path"?: string | null,"tags"?: (string)[],"title": string,"topic"?: string | null,"updated_at"?: string,"visibility"?: string,"workspace_id": string
                  }
                  Update: {
                    "chunk_count"?: number,"content"?: string,"created_at"?: string,"created_by"?: string | null,"error"?: string | null,"id"?: string,"installation_id"?: string | null,"kind"?: string,"module"?: string | null,"origin"?: string | null,"progress"?: number,"source_url"?: string | null,"status"?: string,"storage_path"?: string | null,"tags"?: (string)[],"title"?: string,"topic"?: string | null,"updated_at"?: string,"visibility"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_sources_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_sources_module_fk"
      columns: ["module"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "knowledge_sources_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"knowledge_suggestion_state": {
                  Row: {
                    "decided_at": string,"decided_by": string | null,"state": string,"suggestion_key": string,"workspace_id": string
                  }
                  Insert: {
                    "decided_at"?: string,"decided_by"?: string | null,"state": string,"suggestion_key": string,"workspace_id": string
                  }
                  Update: {
                    "decided_at"?: string,"decided_by"?: string | null,"state"?: string,"suggestion_key"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_suggestion_state_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_flows": {
                  Row: {
                    "analysis": Json | null,"answers": NonNullable<Json>,"asked": number,"closed_at": string | null,"connection_id": string | null,"contact_asked_at": string | null,"conversation_id": string | null,"created_at": string,"email": string | null,"escalated_at": string | null,"escalation_reason": string | null,"followed_up_at": string | null,"greeted_at": string | null,"handed_off_at": string | null,"id": string,"igsid": string | null,"installation_id": string | null,"last_user_at": string | null,"last_user_text": string | null,"lead_id": string | null,"name": string | null,"pending_question": number | null,"phone": string | null,"platform": string | null,"psid": string | null,"resume_state": string | null,"score": string | null,"score_reasons": NonNullable<Json>,"scored_at": string | null,"signals": NonNullable<Json>,"source": NonNullable<Json>,"state": string,"touches": NonNullable<Json>,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "analysis"?: Json | null,"answers"?: NonNullable<Json>,"asked"?: number,"closed_at"?: string | null,"connection_id"?: string | null,"contact_asked_at"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"email"?: string | null,"escalated_at"?: string | null,"escalation_reason"?: string | null,"followed_up_at"?: string | null,"greeted_at"?: string | null,"handed_off_at"?: string | null,"id"?: string,"igsid"?: string | null,"installation_id"?: string | null,"last_user_at"?: string | null,"last_user_text"?: string | null,"lead_id"?: string | null,"name"?: string | null,"pending_question"?: number | null,"phone"?: string | null,"platform"?: string | null,"psid"?: string | null,"resume_state"?: string | null,"score"?: string | null,"score_reasons"?: NonNullable<Json>,"scored_at"?: string | null,"signals"?: NonNullable<Json>,"source"?: NonNullable<Json>,"state"?: string,"touches"?: NonNullable<Json>,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "analysis"?: Json | null,"answers"?: NonNullable<Json>,"asked"?: number,"closed_at"?: string | null,"connection_id"?: string | null,"contact_asked_at"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"email"?: string | null,"escalated_at"?: string | null,"escalation_reason"?: string | null,"followed_up_at"?: string | null,"greeted_at"?: string | null,"handed_off_at"?: string | null,"id"?: string,"igsid"?: string | null,"installation_id"?: string | null,"last_user_at"?: string | null,"last_user_text"?: string | null,"lead_id"?: string | null,"name"?: string | null,"pending_question"?: number | null,"phone"?: string | null,"platform"?: string | null,"psid"?: string | null,"resume_state"?: string | null,"score"?: string | null,"score_reasons"?: NonNullable<Json>,"scored_at"?: string | null,"signals"?: NonNullable<Json>,"source"?: NonNullable<Json>,"state"?: string,"touches"?: NonNullable<Json>,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_flows_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_flows_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "agent_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_flows_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_flows_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_flows_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "channel": string,"company": string,"contact_name": string,"context_summary": string | null,"created_at": string,"email": string | null,"id": string,"installation_id": string | null,"need": string,"origin": string | null,"phone": string | null,"stage": string,"workspace_id": string
                  }
                  Insert: {
                    "channel": string,"company": string,"contact_name": string,"context_summary"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"installation_id"?: string | null,"need": string,"origin"?: string | null,"phone"?: string | null,"stage"?: string,"workspace_id": string
                  }
                  Update: {
                    "channel"?: string,"company"?: string,"contact_name"?: string,"context_summary"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"installation_id"?: string | null,"need"?: string,"origin"?: string | null,"phone"?: string | null,"stage"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_campaigns": {
                  Row: {
                    "created_at": string,"created_by": string,"draft": string,"draft_ms": number | null,"finished_at": string | null,"id": string,"name": string,"recipients": number,"segment": NonNullable<Json>,"status": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"draft"?: string,"draft_ms"?: number | null,"finished_at"?: string | null,"id"?: string,"name": string,"recipients"?: number,"segment"?: NonNullable<Json>,"status"?: string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"draft"?: string,"draft_ms"?: number | null,"finished_at"?: string | null,"id"?: string,"name"?: string,"recipients"?: number,"segment"?: NonNullable<Json>,"status"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_campaigns_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_customer_links": {
                  Row: {
                    "created_at": string,"customer_id": string,"id": string,"kind": string,"ref": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"customer_id": string,"id"?: string,"kind": string,"ref": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"id"?: string,"kind"?: string,"ref"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_customer_links_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "loyalty_customer_links_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loyalty_customer_links_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_customers": {
                  Row: {
                    "birthday": string | null,"created_at": string,"email": string | null,"id": string,"joined_at": string,"name": string,"note": string,"phone": string | null,"tier_key": string | null,"tier_since": string | null,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "birthday"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"joined_at"?: string,"name"?: string,"note"?: string,"phone"?: string | null,"tier_key"?: string | null,"tier_since"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "birthday"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"joined_at"?: string,"name"?: string,"note"?: string,"phone"?: string | null,"tier_key"?: string | null,"tier_since"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_customers_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_ledger": {
                  Row: {
                    "amount_vnd": number | null,"by_name": string,"created_at": string,"customer_id": string,"evidence": string | null,"expires_at": string | null,"id": string,"invoice_id": string | null,"kind": string,"occurred_at": string,"order_id": string | null,"points": number,"ref": string,"reward_id": string | null,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "amount_vnd"?: number | null,"by_name"?: string,"created_at"?: string,"customer_id": string,"evidence"?: string | null,"expires_at"?: string | null,"id"?: string,"invoice_id"?: string | null,"kind": string,"occurred_at"?: string,"order_id"?: string | null,"points": number,"ref": string,"reward_id"?: string | null,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "amount_vnd"?: number | null,"by_name"?: string,"created_at"?: string,"customer_id"?: string,"evidence"?: string | null,"expires_at"?: string | null,"id"?: string,"invoice_id"?: string | null,"kind"?: string,"occurred_at"?: string,"order_id"?: string | null,"points"?: number,"ref"?: string,"reward_id"?: string | null,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_ledger_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "loyalty_ledger_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loyalty_ledger_reward_id_fkey"
      columns: ["reward_id"]
isOneToOne: false
      referencedRelation: "loyalty_rewards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loyalty_ledger_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_otps": {
                  Row: {
                    "attempts": number,"code_hash": string,"created_at": string,"customer_id": string,"expires_at": string,"id": string,"used_at": string | null,"workspace_id": string
                  }
                  Insert: {
                    "attempts"?: number,"code_hash": string,"created_at"?: string,"customer_id": string,"expires_at": string,"id"?: string,"used_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "attempts"?: number,"code_hash"?: string,"created_at"?: string,"customer_id"?: string,"expires_at"?: string,"id"?: string,"used_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_otps_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "loyalty_otps_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loyalty_otps_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_programs": {
                  Row: {
                    "config": NonNullable<Json>,"created_at": string,"enabled": boolean,"name": string,"slug": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"enabled"?: boolean,"name"?: string,"slug": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"enabled"?: boolean,"name"?: string,"slug"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_programs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_rewards": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"key": string,"kind": string,"min_tier_key": string | null,"name": string,"note": string,"per_customer_limit": number | null,"percent": number | null,"points_cost": number,"sort_order": number,"stock": number | null,"value_vnd": number,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"key": string,"kind"?: string,"min_tier_key"?: string | null,"name": string,"note"?: string,"per_customer_limit"?: number | null,"percent"?: number | null,"points_cost": number,"sort_order"?: number,"stock"?: number | null,"value_vnd"?: number,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"key"?: string,"kind"?: string,"min_tier_key"?: string | null,"name"?: string,"note"?: string,"per_customer_limit"?: number | null,"percent"?: number | null,"points_cost"?: number,"sort_order"?: number,"stock"?: number | null,"value_vnd"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_rewards_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_sends": {
                  Row: {
                    "body": string | null,"campaign_id": string,"conversation_id": string | null,"created_at": string,"customer_id": string,"error": string | null,"id": string,"lead_id": string | null,"sent_at": string | null,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "body"?: string | null,"campaign_id": string,"conversation_id"?: string | null,"created_at"?: string,"customer_id": string,"error"?: string | null,"id"?: string,"lead_id"?: string | null,"sent_at"?: string | null,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "body"?: string | null,"campaign_id"?: string,"conversation_id"?: string | null,"created_at"?: string,"customer_id"?: string,"error"?: string | null,"id"?: string,"lead_id"?: string | null,"sent_at"?: string | null,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_sends_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "loyalty_campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loyalty_sends_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_balances"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "loyalty_sends_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "loyalty_customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "loyalty_sends_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "agent_id": string | null,"author_kind": string,"author_name": string,"body": string,"created_at": string,"id": string,"lead_id": string | null,"staff_id": string | null,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "agent_id"?: string | null,"author_kind": string,"author_name": string,"body": string,"created_at"?: string,"id"?: string,"lead_id"?: string | null,"staff_id"?: string | null,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "agent_id"?: string | null,"author_kind"?: string,"author_name"?: string,"body"?: string,"created_at"?: string,"id"?: string,"lead_id"?: string | null,"staff_id"?: string | null,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"meta_comments": {
                  Row: {
                    "comment_at": string | null,"comment_id": string,"connection_id": string,"platform": string,"private_replied_at": string | null
                  }
                  Insert: {
                    "comment_at"?: string | null,"comment_id": string,"connection_id": string,"platform": string,"private_replied_at"?: string | null
                  }
                  Update: {
                    "comment_at"?: string | null,"comment_id"?: string,"connection_id"?: string,"platform"?: string,"private_replied_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "meta_comments_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"meta_threads": {
                  Row: {
                    "connection_id": string,"last_user_at": string,"platform": string,"user_id": string
                  }
                  Insert: {
                    "connection_id": string,"last_user_at": string,"platform": string,"user_id": string
                  }
                  Update: {
                    "connection_id"?: string,"last_user_at"?: string,"platform"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meta_threads_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"module_context_notes": {
                  Row: {
                    "applied_version": number | null,"author_name": string,"author_role": string,"author_user_id": string | null,"body": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"fact_key": string,"id": string,"installation_id": string,"source": string,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "applied_version"?: number | null,"author_name": string,"author_role"?: string,"author_user_id"?: string | null,"body": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"fact_key": string,"id"?: string,"installation_id": string,"source"?: string,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "applied_version"?: number | null,"author_name"?: string,"author_role"?: string,"author_user_id"?: string | null,"body"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"fact_key"?: string,"id"?: string,"installation_id"?: string,"source"?: string,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_context_notes_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_context_notes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"module_context_versions": {
                  Row: {
                    "applied_at": string,"applied_by": string,"id": string,"installation_id": string,"snapshot": NonNullable<Json>,"version": number,"workspace_id": string
                  }
                  Insert: {
                    "applied_at"?: string,"applied_by"?: string,"id"?: string,"installation_id": string,"snapshot": NonNullable<Json>,"version": number,"workspace_id": string
                  }
                  Update: {
                    "applied_at"?: string,"applied_by"?: string,"id"?: string,"installation_id"?: string,"snapshot"?: NonNullable<Json>,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_context_versions_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_context_versions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"module_installations": {
                  Row: {
                    "active_context_version_id": string | null,"agent_id": string | null,"created_at": string,"id": string,"is_multi": boolean,"live_enabled": boolean,"module_key": string,"name": string,"operating_mode": string,"settings": NonNullable<Json>,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "active_context_version_id"?: string | null,"agent_id"?: string | null,"created_at"?: string,"id"?: string,"is_multi"?: boolean,"live_enabled"?: boolean,"module_key": string,"name": string,"operating_mode"?: string,"settings"?: NonNullable<Json>,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "active_context_version_id"?: string | null,"agent_id"?: string | null,"created_at"?: string,"id"?: string,"is_multi"?: boolean,"live_enabled"?: boolean,"module_key"?: string,"name"?: string,"operating_mode"?: string,"settings"?: NonNullable<Json>,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_installations_active_version_fk"
      columns: ["active_context_version_id"]
isOneToOne: false
      referencedRelation: "module_context_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_installations_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_installations_module_key_fk"
      columns: ["module_key"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "module_installations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"module_setup_messages": {
                  Row: {
                    "author": string,"body": string,"created_at": string,"id": string,"role": string,"setup_session_id": string,"workspace_id": string
                  }
                  Insert: {
                    "author"?: string,"body": string,"created_at"?: string,"id"?: string,"role": string,"setup_session_id": string,"workspace_id": string
                  }
                  Update: {
                    "author"?: string,"body"?: string,"created_at"?: string,"id"?: string,"role"?: string,"setup_session_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_setup_messages_setup_session_id_fkey"
      columns: ["setup_session_id"]
isOneToOne: false
      referencedRelation: "module_setup_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_setup_messages_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"module_setup_sessions": {
                  Row: {
                    "created_at": string,"draft_snapshot": NonNullable<Json>,"gate_evidence": NonNullable<Json>,"id": string,"installation_id": string,"revision": number,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"draft_snapshot"?: NonNullable<Json>,"gate_evidence"?: NonNullable<Json>,"id"?: string,"installation_id": string,"revision"?: number,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"draft_snapshot"?: NonNullable<Json>,"gate_evidence"?: NonNullable<Json>,"id"?: string,"installation_id"?: string,"revision"?: number,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_setup_sessions_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_setup_sessions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"module_setup_writes": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"gate_key": string,"id": string,"kind": string,"payload": NonNullable<Json>,"result": Json | null,"setup_session_id": string,"source_message_id": string | null,"status": string,"target_key": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"gate_key": string,"id"?: string,"kind": string,"payload": NonNullable<Json>,"result"?: Json | null,"setup_session_id": string,"source_message_id"?: string | null,"status"?: string,"target_key": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"gate_key"?: string,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"result"?: Json | null,"setup_session_id"?: string,"source_message_id"?: string | null,"status"?: string,"target_key"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "module_setup_writes_setup_session_id_fkey"
      columns: ["setup_session_id"]
isOneToOne: false
      referencedRelation: "module_setup_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_setup_writes_source_message_id_fkey"
      columns: ["source_message_id"]
isOneToOne: false
      referencedRelation: "module_setup_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "module_setup_writes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "audience": string,"category": string,"default_operating_mode": string,"definition": NonNullable<Json>,"key": string,"knowledge_folder": string,"multi_instance": boolean,"sort_order": number,"status": string,"updated_at": string,"workbench": string | null
                  }
                  Insert: {
                    "audience"?: string,"category": string,"default_operating_mode"?: string,"definition"?: NonNullable<Json>,"key": string,"knowledge_folder": string,"multi_instance"?: boolean,"sort_order"?: number,"status"?: string,"updated_at"?: string,"workbench"?: string | null
                  }
                  Update: {
                    "audience"?: string,"category"?: string,"default_operating_mode"?: string,"definition"?: NonNullable<Json>,"key"?: string,"knowledge_folder"?: string,"multi_instance"?: boolean,"sort_order"?: number,"status"?: string,"updated_at"?: string,"workbench"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"n8n_pipelines": {
                  Row: {
                    "config": NonNullable<Json>,"created_at": string,"enabled": boolean,"template_key": string,"updated_at": string,"updated_by": string | null,"workspace_id": string
                  }
                  Insert: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"enabled"?: boolean,"template_key": string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"enabled"?: boolean,"template_key"?: string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "n8n_pipelines_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"n8n_platform_config": {
                  Row: {
                    "key": string,"value": string
                  }
                  Insert: {
                    "key": string,"value": string
                  }
                  Update: {
                    "key"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"n8n_runs": {
                  Row: {
                    "created_at": string,"dedupe_key": string,"engine_job_id": string | null,"expires_at": string,"finished_at": string | null,"id": string,"result": Json | null,"status": string,"summary": string | null,"template_key": string,"token_hash": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"dedupe_key": string,"engine_job_id"?: string | null,"expires_at": string,"finished_at"?: string | null,"id"?: string,"result"?: Json | null,"status"?: string,"summary"?: string | null,"template_key": string,"token_hash": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string,"engine_job_id"?: string | null,"expires_at"?: string,"finished_at"?: string | null,"id"?: string,"result"?: Json | null,"status"?: string,"summary"?: string | null,"template_key"?: string,"token_hash"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "n8n_runs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"nivo_knowledge": {
                  Row: {
                    "body": string,"embedding": string | null,"embedding_model": string | null,"fts": unknown,"id": string,"kind": string,"module": string,"slug": string,"title": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "body": string,"embedding"?: string | null,"embedding_model"?: string | null,"fts"?: never,"id"?: string,"kind": string,"module": string,"slug": string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "body"?: string,"embedding"?: string | null,"embedding_model"?: string | null,"fts"?: never,"id"?: string,"kind"?: string,"module"?: string,"slug"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"office_command_candidates": {
                  Row: {
                    "command": string,"created_at": string,"created_by": string,"decided_at": string | null,"id": string,"message_id": string,"module": string,"payload": NonNullable<Json>,"refusal_detail": string | null,"shown": NonNullable<Json>,"status": string,"summary": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "command": string,"created_at"?: string,"created_by"?: string,"decided_at"?: string | null,"id"?: string,"message_id": string,"module": string,"payload"?: NonNullable<Json>,"refusal_detail"?: string | null,"shown"?: NonNullable<Json>,"status"?: string,"summary"?: string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "command"?: string,"created_at"?: string,"created_by"?: string,"decided_at"?: string | null,"id"?: string,"message_id"?: string,"module"?: string,"payload"?: NonNullable<Json>,"refusal_detail"?: string | null,"shown"?: NonNullable<Json>,"status"?: string,"summary"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "office_command_candidates_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "office_command_candidates_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "office_command_candidates_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"openclaw_agent_sync": {
                  Row: {
                    "agent_id": string,"checked_at": string,"content_hash": string | null,"context_version": number | null,"error": string | null,"files": NonNullable<Json>,"installation_id": string,"status": string,"synced_at": string | null,"workspace_id": string
                  }
                  Insert: {
                    "agent_id": string,"checked_at"?: string,"content_hash"?: string | null,"context_version"?: number | null,"error"?: string | null,"files"?: NonNullable<Json>,"installation_id": string,"status"?: string,"synced_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "agent_id"?: string,"checked_at"?: string,"content_hash"?: string | null,"context_version"?: number | null,"error"?: string | null,"files"?: NonNullable<Json>,"installation_id"?: string,"status"?: string,"synced_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "openclaw_agent_sync_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: true
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "openclaw_agent_sync_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "amount_vnd": number | null,"carrier": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"id": string,"inbound_event_id": string | null,"items": string,"lead_id": string | null,"order_no": string,"origin": string,"shipped_at": string | null,"status": string,"tracking_code": string | null,"workspace_id": string
                  }
                  Insert: {
                    "amount_vnd"?: number | null,"carrier"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"id"?: string,"inbound_event_id"?: string | null,"items"?: string,"lead_id"?: string | null,"order_no": string,"origin"?: string,"shipped_at"?: string | null,"status"?: string,"tracking_code"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "amount_vnd"?: number | null,"carrier"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"id"?: string,"inbound_event_id"?: string | null,"items"?: string,"lead_id"?: string | null,"order_no"?: string,"origin"?: string,"shipped_at"?: string | null,"status"?: string,"tracking_code"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_inbound_event_id_fkey"
      columns: ["inbound_event_id"]
isOneToOne: false
      referencedRelation: "inbound_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_order_requests": {
                  Row: {
                    "answered_at": string | null,"created_at": string,"fault": string | null,"id": string,"kind": string,"order_id": string | null,"requested_by": string,"status": string,"target": string | null,"workspace_id": string
                  }
                  Insert: {
                    "answered_at"?: string | null,"created_at"?: string,"fault"?: string | null,"id"?: string,"kind": string,"order_id"?: string | null,"requested_by": string,"status"?: string,"target"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "answered_at"?: string | null,"created_at"?: string,"fault"?: string | null,"id"?: string,"kind"?: string,"order_id"?: string | null,"requested_by"?: string,"status"?: string,"target"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_order_requests_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "payment_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_order_requests_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_orders": {
                  Row: {
                    "amount_vnd": number,"created_at": string,"created_by": string | null,"detail": NonNullable<Json>,"expires_at": string,"id": string,"kind": string,"order_code": string,"pack_code": string | null,"paid_at": string | null,"plan_code": string,"sepay_transaction_id": number | null,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "amount_vnd": number,"created_at"?: string,"created_by"?: string | null,"detail"?: NonNullable<Json>,"expires_at"?: string,"id"?: string,"kind"?: string,"order_code": string,"pack_code"?: string | null,"paid_at"?: string | null,"plan_code": string,"sepay_transaction_id"?: number | null,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount_vnd"?: number,"created_at"?: string,"created_by"?: string | null,"detail"?: NonNullable<Json>,"expires_at"?: string,"id"?: string,"kind"?: string,"order_code"?: string,"pack_code"?: string | null,"paid_at"?: string | null,"plan_code"?: string,"sepay_transaction_id"?: number | null,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_orders_pack_code_fkey"
      columns: ["pack_code"]
isOneToOne: false
      referencedRelation: "credit_packs"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "payment_orders_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "payment_orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "active": boolean,"ai_credits_per_month": number | null,"ai_messages_per_month": number | null,"ai_tokens_per_month": number | null,"code": string,"credits_rollover": boolean,"features": NonNullable<Json>,"is_custom": boolean,"name_en": string,"name_vi": string,"period": string,"price_vnd": number,"seats": number,"sort": number
                  }
                  Insert: {
                    "active"?: boolean,"ai_credits_per_month"?: number | null,"ai_messages_per_month"?: number | null,"ai_tokens_per_month"?: number | null,"code": string,"credits_rollover"?: boolean,"features"?: NonNullable<Json>,"is_custom"?: boolean,"name_en": string,"name_vi": string,"period": string,"price_vnd": number,"seats": number,"sort"?: number
                  }
                  Update: {
                    "active"?: boolean,"ai_credits_per_month"?: number | null,"ai_messages_per_month"?: number | null,"ai_tokens_per_month"?: number | null,"code"?: string,"credits_rollover"?: boolean,"features"?: NonNullable<Json>,"is_custom"?: boolean,"name_en"?: string,"name_vi"?: string,"period"?: string,"price_vnd"?: number,"seats"?: number,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"email": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_audit": {
                  Row: {
                    "action": string,"actor_email": string,"actor_id": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"workspace_id": string | null
                  }
                  Insert: {
                    "action": string,"actor_email": string,"actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"workspace_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_email"?: string,"actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_audit_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_flags": {
                  Row: {
                    "enabled": boolean,"key": string
                  }
                  Insert: {
                    "enabled"?: boolean,"key": string
                  }
                  Update: {
                    "enabled"?: boolean,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"public_api": {
                  Row: {
                    "created_at": string,"dedupe_key": string,"duplicates": number,"id": string,"key_id": string,"kind": string,"lead_id": string | null,"payload": NonNullable<Json>,"processed_at": string | null,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"dedupe_key": string,"duplicates"?: number,"id"?: string,"key_id": string,"kind": string,"lead_id"?: string | null,"payload": NonNullable<Json>,"processed_at"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string,"duplicates"?: number,"id"?: string,"key_id"?: string,"kind"?: string,"lead_id"?: string | null,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "public_api_key_id_fkey"
      columns: ["key_id"]
isOneToOne: false
      referencedRelation: "api_keys"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "public_api_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "public_api_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"queue": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"queue": string,"sent_at": string | null
                  }
                  Insert: {
                    "created_at": string,"id"?: string,"payload": NonNullable<Json>,"queue": string,"sent_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"queue"?: string,"sent_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"responsibilities": {
                  Row: {
                    "created_at": string,"due_at": string | null,"id": string,"lead_id": string,"next_action": string,"owner_agent_id": string | null,"owner_kind": string,"owner_name": string,"status": string,"title": string,"workspace_id": string,"lead_step_json": Json | null
                  }
                  Insert: {
                    "created_at"?: string,"due_at"?: string | null,"id"?: string,"lead_id": string,"next_action": string,"owner_agent_id"?: string | null,"owner_kind": string,"owner_name": string,"status"?: string,"title": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"due_at"?: string | null,"id"?: string,"lead_id"?: string,"next_action"?: string,"owner_agent_id"?: string | null,"owner_kind"?: string,"owner_name"?: string,"status"?: string,"title"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "responsibilities_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "responsibilities_owner_agent_id_fkey"
      columns: ["owner_agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "responsibilities_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"sepay_transactions": {
                  Row: {
                    "content": string | null,"id": string,"matched_order_id": string | null,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"sepay_id": number,"status": string,"transfer_amount": number | null
                  }
                  Insert: {
                    "content"?: string | null,"id"?: string,"matched_order_id"?: string | null,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"sepay_id": number,"status"?: string,"transfer_amount"?: number | null
                  }
                  Update: {
                    "content"?: string | null,"id"?: string,"matched_order_id"?: string | null,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"sepay_id"?: number,"status"?: string,"transfer_amount"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sepay_transactions_matched_order_id_fkey"
      columns: ["matched_order_id"]
isOneToOne: false
      referencedRelation: "payment_orders"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_attendance": {
                  Row: {
                    "checked_in_at": string,"id": string,"shift_id": string,"staff_id": string,"workspace_id": string
                  }
                  Insert: {
                    "checked_in_at"?: string,"id"?: string,"shift_id": string,"staff_id": string,"workspace_id": string
                  }
                  Update: {
                    "checked_in_at"?: string,"id"?: string,"shift_id"?: string,"staff_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_attendance_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts_shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_attendance_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_attendance_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_availability": {
                  Row: {
                    "available": boolean,"created_at": string,"decided_by": string | null,"end_time": string,"id": string,"note": string,"shift_date": string | null,"staff_id": string,"start_time": string,"status": string,"weekday": number | null,"workspace_id": string
                  }
                  Insert: {
                    "available"?: boolean,"created_at"?: string,"decided_by"?: string | null,"end_time"?: string,"id"?: string,"note"?: string,"shift_date"?: string | null,"staff_id": string,"start_time"?: string,"status"?: string,"weekday"?: number | null,"workspace_id": string
                  }
                  Update: {
                    "available"?: boolean,"created_at"?: string,"decided_by"?: string | null,"end_time"?: string,"id"?: string,"note"?: string,"shift_date"?: string | null,"staff_id"?: string,"start_time"?: string,"status"?: string,"weekday"?: number | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_availability_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_availability_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_coverage": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"ideal_staff": number,"is_peak": boolean,"min_staff": number,"position_id": string,"start_time": string,"weekday": number,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"ideal_staff"?: number,"is_peak"?: boolean,"min_staff"?: number,"position_id": string,"start_time": string,"weekday": number,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"ideal_staff"?: number,"is_peak"?: boolean,"min_staff"?: number,"position_id"?: string,"start_time"?: string,"weekday"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_coverage_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "shifts_positions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_coverage_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_leave_requests": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"from_date": string,"id": string,"reason": string,"staff_id": string,"status": string,"to_date": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"from_date": string,"id"?: string,"reason"?: string,"staff_id": string,"status"?: string,"to_date": string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"from_date"?: string,"id"?: string,"reason"?: string,"staff_id"?: string,"status"?: string,"to_date"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_leave_requests_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_leave_requests_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_leave_requests_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_notifications": {
                  Row: {
                    "body": string,"channel": string,"created_at": string,"error": string | null,"id": string,"kind": string,"schedule_id": string | null,"shift_id": string | null,"staff_id": string | null,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "body"?: string,"channel": string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind": string,"schedule_id"?: string | null,"shift_id"?: string | null,"staff_id"?: string | null,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "body"?: string,"channel"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind"?: string,"schedule_id"?: string | null,"shift_id"?: string | null,"staff_id"?: string | null,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_notifications_schedule_id_fkey"
      columns: ["schedule_id"]
isOneToOne: false
      referencedRelation: "shifts_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_notifications_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts_shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_notifications_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_notifications_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_positions": {
                  Row: {
                    "active": boolean,"color": string,"created_at": string,"id": string,"name": string,"sort_order": number,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"color"?: string,"created_at"?: string,"id"?: string,"name": string,"sort_order"?: number,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_positions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_schedules": {
                  Row: {
                    "cost_vnd": number,"created_at": string,"created_by": string | null,"evidence": NonNullable<Json>,"explanation": string,"id": string,"published_at": string | null,"solver_ms": number | null,"source": string,"status": string,"summary": NonNullable<Json>,"version": number,"week_start": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "cost_vnd"?: number,"created_at"?: string,"created_by"?: string | null,"evidence"?: NonNullable<Json>,"explanation"?: string,"id"?: string,"published_at"?: string | null,"solver_ms"?: number | null,"source"?: string,"status"?: string,"summary"?: NonNullable<Json>,"version"?: number,"week_start": string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "cost_vnd"?: number,"created_at"?: string,"created_by"?: string | null,"evidence"?: NonNullable<Json>,"explanation"?: string,"id"?: string,"published_at"?: string | null,"solver_ms"?: number | null,"source"?: string,"status"?: string,"summary"?: NonNullable<Json>,"version"?: number,"week_start"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_schedules_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_schedules_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_settings": {
                  Row: {
                    "leave_notice_days": number,"noshow_minutes": number,"opening_hours": NonNullable<Json>,"overtime_hours_week": number,"remind_minutes": number,"swap_notice_hours": number,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "leave_notice_days"?: number,"noshow_minutes"?: number,"opening_hours"?: NonNullable<Json>,"overtime_hours_week"?: number,"remind_minutes"?: number,"swap_notice_hours"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "leave_notice_days"?: number,"noshow_minutes"?: number,"opening_hours"?: NonNullable<Json>,"overtime_hours_week"?: number,"remind_minutes"?: number,"swap_notice_hours"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_shifts": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"note": string,"position_id": string,"schedule_id": string,"shift_date": string,"source": string,"staff_id": string | null,"start_time": string,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"note"?: string,"position_id": string,"schedule_id": string,"shift_date": string,"source"?: string,"staff_id"?: string | null,"start_time": string,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"note"?: string,"position_id"?: string,"schedule_id"?: string,"shift_date"?: string,"source"?: string,"staff_id"?: string | null,"start_time"?: string,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_shifts_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "shifts_positions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_shifts_schedule_id_fkey"
      columns: ["schedule_id"]
isOneToOne: false
      referencedRelation: "shifts_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_shifts_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_shifts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_staff": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"max_hours_day": number,"max_hours_week": number,"min_rest_hours": number,"name": string,"phone": string | null,"position_ids": (string)[],"skills": (string)[],"staff_id": string | null,"telegram_chat_id": string | null,"user_id": string | null,"workspace_id": string,"zalo_user_id": string | null
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"max_hours_day"?: number,"max_hours_week"?: number,"min_rest_hours"?: number,"name": string,"phone"?: string | null,"position_ids"?: (string)[],"skills"?: (string)[],"staff_id"?: string | null,"telegram_chat_id"?: string | null,"user_id"?: string | null,"workspace_id": string,"zalo_user_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"max_hours_day"?: number,"max_hours_week"?: number,"min_rest_hours"?: number,"name"?: string,"phone"?: string | null,"position_ids"?: (string)[],"skills"?: (string)[],"staff_id"?: string | null,"telegram_chat_id"?: string | null,"user_id"?: string | null,"workspace_id"?: string,"zalo_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_staff_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_staff_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_staff_pay": {
                  Row: {
                    "hourly_wage_vnd": number,"staff_id": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "hourly_wage_vnd"?: number,"staff_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "hourly_wage_vnd"?: number,"staff_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_staff_pay_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: true
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_staff_pay_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts_swap_requests": {
                  Row: {
                    "checks": NonNullable<Json>,"created_at": string,"decided_at": string | null,"decided_by": string | null,"from_staff_id": string | null,"id": string,"kind": string,"reason": string,"shift_id": string,"status": string,"to_staff_id": string,"work_item_id": string | null,"workspace_id": string
                  }
                  Insert: {
                    "checks"?: NonNullable<Json>,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"from_staff_id"?: string | null,"id"?: string,"kind"?: string,"reason"?: string,"shift_id": string,"status"?: string,"to_staff_id": string,"work_item_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "checks"?: NonNullable<Json>,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"from_staff_id"?: string | null,"id"?: string,"kind"?: string,"reason"?: string,"shift_id"?: string,"status"?: string,"to_staff_id"?: string,"work_item_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_swap_requests_from_staff_id_fkey"
      columns: ["from_staff_id"]
isOneToOne: false
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_swap_requests_shift_id_fkey"
      columns: ["shift_id"]
isOneToOne: false
      referencedRelation: "shifts_shifts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_swap_requests_to_staff_id_fkey"
      columns: ["to_staff_id"]
isOneToOne: false
      referencedRelation: "shifts_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_swap_requests_work_item_id_fkey"
      columns: ["work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_swap_requests_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "active": boolean,"created_at": string,"email": string | null,"id": string,"name": string,"role": string,"workspace_id": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"email"?: string | null,"id"?: string,"name": string,"role"?: string,"workspace_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string,"role"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"telegram_inbox": {
                  Row: {
                    "delivery_id": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string
                  }
                  Insert: {
                    "delivery_id": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "delivery_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "amount_vnd": number,"channel": string,"created_at": string,"id": string,"inbound_event_id": string | null,"invoice_id": string | null,"occurred_at": string,"origin": string,"payer": string | null,"reference": string | null,"status": string,"workspace_id": string
                  }
                  Insert: {
                    "amount_vnd": number,"channel"?: string,"created_at"?: string,"id"?: string,"inbound_event_id"?: string | null,"invoice_id"?: string | null,"occurred_at"?: string,"origin"?: string,"payer"?: string | null,"reference"?: string | null,"status"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount_vnd"?: number,"channel"?: string,"created_at"?: string,"id"?: string,"inbound_event_id"?: string | null,"invoice_id"?: string | null,"occurred_at"?: string,"origin"?: string,"payer"?: string | null,"reference"?: string | null,"status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_inbound_event_id_fkey"
      columns: ["inbound_event_id"]
isOneToOne: false
      referencedRelation: "inbound_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"video_brand_kits": {
                  Row: {
                    "logo_path": string | null,"music_track": string | null,"primary_color": string,"secondary_color": string,"shop_name": string,"updated_at": string,"updated_by": string | null,"voice": string,"workspace_id": string
                  }
                  Insert: {
                    "logo_path"?: string | null,"music_track"?: string | null,"primary_color"?: string,"secondary_color"?: string,"shop_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"voice"?: string,"workspace_id": string
                  }
                  Update: {
                    "logo_path"?: string | null,"music_track"?: string | null,"primary_color"?: string,"secondary_color"?: string,"shop_name"?: string,"updated_at"?: string,"updated_by"?: string | null,"voice"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_brand_kits_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"video_project_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"note": string | null,"project_id": string,"render_id": string | null,"script": NonNullable<Json>,"spec": Json | null,"version": number,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"project_id": string,"render_id"?: string | null,"script": NonNullable<Json>,"spec"?: Json | null,"version": number,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"project_id"?: string,"render_id"?: string | null,"script"?: NonNullable<Json>,"spec"?: Json | null,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_project_versions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "video_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_project_versions_render_id_fkey"
      columns: ["render_id"]
isOneToOne: false
      referencedRelation: "video_renders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_project_versions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"video_projects": {
                  Row: {
                    "approved_at": string | null,"approved_by_name": string | null,"aspect": string,"created_at": string,"created_by": string | null,"current_spec": Json | null,"goal": string,"id": string,"inputs": NonNullable<Json>,"last_error": string | null,"publish_work_item_id": string | null,"published_at": string | null,"render_id": string | null,"render_ids": (string)[],"script": NonNullable<Json>,"script_meta": NonNullable<Json>,"script_ms": number | null,"source_project_id": string | null,"status": string,"target_seconds": number,"title": string,"updated_at": string,"version": number,"workspace_id": string
                  }
                  Insert: {
                    "approved_at"?: string | null,"approved_by_name"?: string | null,"aspect"?: string,"created_at"?: string,"created_by"?: string | null,"current_spec"?: Json | null,"goal"?: string,"id"?: string,"inputs"?: NonNullable<Json>,"last_error"?: string | null,"publish_work_item_id"?: string | null,"published_at"?: string | null,"render_id"?: string | null,"render_ids"?: (string)[],"script"?: NonNullable<Json>,"script_meta"?: NonNullable<Json>,"script_ms"?: number | null,"source_project_id"?: string | null,"status"?: string,"target_seconds"?: number,"title": string,"updated_at"?: string,"version"?: number,"workspace_id": string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by_name"?: string | null,"aspect"?: string,"created_at"?: string,"created_by"?: string | null,"current_spec"?: Json | null,"goal"?: string,"id"?: string,"inputs"?: NonNullable<Json>,"last_error"?: string | null,"publish_work_item_id"?: string | null,"published_at"?: string | null,"render_id"?: string | null,"render_ids"?: (string)[],"script"?: NonNullable<Json>,"script_meta"?: NonNullable<Json>,"script_ms"?: number | null,"source_project_id"?: string | null,"status"?: string,"target_seconds"?: number,"title"?: string,"updated_at"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_projects_publish_work_item_id_fkey"
      columns: ["publish_work_item_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_projects_render_id_fkey"
      columns: ["render_id"]
isOneToOne: false
      referencedRelation: "video_renders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_projects_source_project_id_fkey"
      columns: ["source_project_id"]
isOneToOne: false
      referencedRelation: "video_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_projects_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"video_renders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"duration_ms": number | null,"error": string | null,"finished_at": string | null,"id": string,"meta": NonNullable<Json>,"output_path": string | null,"poster_path": string | null,"progress": number,"size_bytes": number | null,"spec": NonNullable<Json>,"stage": string | null,"started_at": string | null,"status": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"meta"?: NonNullable<Json>,"output_path"?: string | null,"poster_path"?: string | null,"progress"?: number,"size_bytes"?: number | null,"spec": NonNullable<Json>,"stage"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"meta"?: NonNullable<Json>,"output_path"?: string | null,"poster_path"?: string | null,"progress"?: number,"size_bytes"?: number | null,"spec"?: NonNullable<Json>,"stage"?: string | null,"started_at"?: string | null,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_renders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"work_items": {
                  Row: {
                    "action": string,"assigned_staff_id": string | null,"chain_id": string | null,"completed_at": string | null,"created_at": string,"decided_path": string | null,"dedupe_key": string,"department": string,"depth": number,"error": string | null,"evidence_state": string,"execution_id": string | null,"id": string,"inbound_event_id": string | null,"installation_id": string | null,"lead_id": string | null,"missing_fields": (string)[],"origin": string,"parent_id": string | null,"proposal": NonNullable<Json>,"reason": string | null,"reasons": (string)[],"result": Json | null,"status": string,"subject_id": string | null,"subject_type": string,"updated_at": string,"workspace_id": string
                  }
                  Insert: {
                    "action": string,"assigned_staff_id"?: string | null,"chain_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"decided_path"?: string | null,"dedupe_key": string,"department": string,"depth"?: number,"error"?: string | null,"evidence_state"?: string,"execution_id"?: string | null,"id"?: string,"inbound_event_id"?: string | null,"installation_id"?: string | null,"lead_id"?: string | null,"missing_fields"?: (string)[],"origin"?: string,"parent_id"?: string | null,"proposal"?: NonNullable<Json>,"reason"?: string | null,"reasons"?: (string)[],"result"?: Json | null,"status"?: string,"subject_id"?: string | null,"subject_type": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"assigned_staff_id"?: string | null,"chain_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"decided_path"?: string | null,"dedupe_key"?: string,"department"?: string,"depth"?: number,"error"?: string | null,"evidence_state"?: string,"execution_id"?: string | null,"id"?: string,"inbound_event_id"?: string | null,"installation_id"?: string | null,"lead_id"?: string | null,"missing_fields"?: (string)[],"origin"?: string,"parent_id"?: string | null,"proposal"?: NonNullable<Json>,"reason"?: string | null,"reasons"?: (string)[],"result"?: Json | null,"status"?: string,"subject_id"?: string | null,"subject_type"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_items_assigned_staff_id_fkey"
      columns: ["assigned_staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_department_fk"
      columns: ["department"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "work_items_execution_id_fkey"
      columns: ["execution_id"]
isOneToOne: false
      referencedRelation: "executions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_inbound_event_id_fkey"
      columns: ["inbound_event_id"]
isOneToOne: false
      referencedRelation: "inbound_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_installation_id_fkey"
      columns: ["installation_id"]
isOneToOne: false
      referencedRelation: "module_installations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "work_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_items_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null,"role": string,"staff_id": string | null,"token_hash": string,"workspace_id": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role": string,"staff_id"?: string | null,"token_hash": string,"workspace_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role"?: string,"staff_id"?: string | null,"token_hash"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_invites_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_invites_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"role": string,"staff_id": string | null,"status": string,"user_id": string,"workspace_id": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name": string,"id"?: string,"role": string,"staff_id"?: string | null,"status"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"role"?: string,"staff_id"?: string | null,"status"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "business_type": string | null,"created_at": string,"id": string,"name": string,"owner_id": string,"paid_until": string | null,"plan_code": string | null,"status": string
                  }
                  Insert: {
                    "business_type"?: string | null,"created_at"?: string,"id"?: string,"name": string,"owner_id": string,"paid_until"?: string | null,"plan_code"?: string | null,"status"?: string
                  }
                  Update: {
                    "business_type"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"paid_until"?: string | null,"plan_code"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"zalo_inbox": {
                  Row: {
                    "delivery_id": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string
                  }
                  Insert: {
                    "delivery_id": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "delivery_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"zalo_wizard_drafts": {
                  Row: {
                    "app_id": string | null,"app_secret": string | null,"connection_id": string,"created_at": string,"oa_secret": string | null
                  }
                  Insert: {
                    "app_id"?: string | null,"app_secret"?: string | null,"connection_id": string,"created_at"?: string,"oa_secret"?: string | null
                  }
                  Update: {
                    "app_id"?: string | null,"app_secret"?: string | null,"connection_id"?: string,"created_at"?: string,"oa_secret"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "zalo_wizard_drafts_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: true
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "ai_usage_daily": {
                  Row: {
                    "calls": number | null,"completion_tokens": number | null,"cost_usd": number | null,"day": string | null,"kind": string | null,"module": string | null,"prompt_tokens": number | null,"workspace_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"loyalty_balances": {
                  Row: {
                    "customer_id": string | null,"last_visit_at": string | null,"lifetime_earned": number | null,"lifetime_spend_vnd": number | null,"points": number | null,"visits": number | null,"workspace_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "loyalty_customers_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invite":
{ Args: { "token": string }; Returns: string
                           },
"agent_chat_send":
{ Args: { "p_body": string; "p_conversation": string }; Returns: string
                           },
"agent_chat_start":
{ Args: { "p_agent": string; "p_kind": string; "p_visitor"?: string }; Returns: string
                           },
"agent_chat_take_over":
{ Args: { "p_conversation": string; "p_line"?: string; "p_take": boolean }; Returns: string
                           },
"add_lead_responsibility":
{ Args: { "p_due"?: string,"p_lead": string,"p_locale"?: string,"p_next_action": string,"p_owner": string,"p_title": string,"p_workspace": string }; Returns: Json
                           },
"admin_console_audit":
{ Args: { "p_action": string,"p_data"?: Json,"p_workspace"?: string }; Returns: undefined
                           },
"admin_console_quota":
{ Args: { "p_workspace": string }; Returns: Json
                           },
"admin_console_signups":
{ Args: { "p_days"?: number }; Returns: {
              "day": string,"signups": number
            }[]
                           },
"admin_console_user_emails":
{ Args: { "p_ids": (string)[] }; Returns: {
              "email": string,"id": string,"last_sign_in_at": string
            }[]
                           },
"admin_console_workspace_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "last_customer_message_at": string,"members": number,"messages_7d": number,"open_decisions": number,"workspace_id": string
            }[]
                           },
"admin_extend_subscription":
{ Args: { "p_days": number,"p_workspace": string }; Returns: string
                           },
"admin_set_workspace_plan":
{ Args: { "p_credits"?: number,"p_plan": string,"p_workspace": string }; Returns: Json
                           },
"admin_set_workspace_status":
{ Args: { "p_status": string,"p_workspace": string }; Returns: string
                           },
"admin_signups_per_day":
{ Args: { "p_days"?: number }; Returns: {
              "day": string,"signups": number
            }[]
                           },
"admin_workspace_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "last_customer_message_at": string,"members": number,"messages_7d": number,"open_decisions": number,"workspace_id": string
            }[]
                           },
"ai_credit_period":
{ Args: { "p_period": string,"p_workspace": string }; Returns: {
              "base": number,"carry": number,"credits_limit": number,"used": number
            }[]
                           },
"ai_quota_status":
{ Args: { "p_workspace": string }; Returns: {
              "cost_usd": number,"credits_carried": number,"credits_limit": number,"credits_used": number,"fallback_reply": string,"messages_limit": number,"messages_used": number,"period_start": string,"tokens_limit": number,"tokens_used": number,"topup_balance": number
            }[]
                           },
"api_key_auth":
{ Args: { "p_hash": string }; Returns: Json
                           },
"api_key_create":
{ Args: { "p_name": string,"p_workspace": string }; Returns: Json
                           },
"api_key_revoke":
{ Args: { "p_key": string,"p_workspace": string }; Returns: Json
                           },
"api_rate_hit":
{ Args: { "p_key": string }; Returns: number
                           },
"assign_lead_responsibility":
{ Args: { "p_due"?: string,"p_locale"?: string,"p_next_action": string,"p_owner": string,"p_responsibility": string,"p_title"?: string,"p_workspace": string }; Returns: Json
                           },
"automation_tick":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"automations_data":
{ Args: { "ws": string }; Returns: Json
                           },
"booking_peak_load":
{ Args: { "p_block_end": string,"p_exclude": string,"p_resource": string,"p_start": string }; Returns: number
                           },
"booking_rate_hit":
{ Args: { "p_key": string,"p_limit": number,"p_window_sec": number }; Returns: boolean
                           },
"booking_relocate":
{ Args: { "p_block_end": string,"p_booking": string,"p_end": string,"p_force"?: boolean,"p_resource": string,"p_start": string }; Returns: boolean
                           },
"booking_reserve":
{ Args: { "p": Json,"p_force"?: boolean }; Returns: string
                           },
"connection_mark_fed":
{ Args: { "p_at": string,"p_connection": string,"p_first_event": Json }; Returns: undefined
                           },
"create_free_workspace":
{ Args: { "p_name": string }; Returns: string
                           },
"dashboard_data":
{ Args: { "founding_from": string,"founding_to": string,"since7": string,"ws": string }; Returns: Json
                           },
"display_name_of":
{ Args: { "uid": string }; Returns: string
                           },
"engine_claim_jobs":
{ Args: { "p_kinds": (string)[],"p_lease_seconds"?: number,"p_limit"?: number,"p_worker": string }; Returns: {
              "attempts": number,
"created_at": string,
"dedupe_key": string | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"kind": string,
"locked_by": string | null,
"locked_until": string | null,
"max_attempts": number,
"payload": NonNullable<Json>,
"result": Json | null,
"run_at": string,
"status": string,
"workspace_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "engine_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"engine_complete_job":
{ Args: { "p_job": string,"p_result"?: Json,"p_worker": string }; Returns: boolean
                           },
"engine_enqueue":
{ Args: { "p_dedupe_key"?: string,"p_kind": string,"p_max_attempts"?: number,"p_payload"?: Json,"p_run_at"?: string,"p_workspace": string }; Returns: string
                           },
"engine_enqueue_agent_sync":
{ Args: { "p_force"?: boolean,"p_installation": string }; Returns: string
                           },
"engine_enqueue_workspace_sync":
{ Args: { "p_workspace": string }; Returns: number
                           },
"engine_fail_job":
{ Args: { "p_error": string,"p_job": string,"p_permanent"?: boolean,"p_retry_after_seconds"?: number,"p_worker": string }; Returns: string
                           },
"engine_heartbeat_job":
{ Args: { "p_job": string,"p_lease_seconds"?: number,"p_worker": string }; Returns: boolean
                           },
"engine_mark_connection_health":
{ Args: { "p_connection": string,"p_health": Json,"p_workspace": string }; Returns: boolean
                           },
"engine_release_job":
{ Args: { "p_job": string,"p_worker": string }; Returns: boolean
                           },
"engine_schedule_agent_sync":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"engine_schedule_connection_health":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"engine_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "last_heartbeat_at": string,"online": boolean,"workers": number
            }[]
                           },
"engine_sweep_authorized":
{ Args: { "p_secret": string }; Returns: boolean
                           },
"engine_sweep_claim":
{ Args: Record<PropertyKey, never>; Returns: {
              "attempts": number,
"created_at": string,
"dedupe_key": string | null,
"error": string | null,
"finished_at": string | null,
"id": string,
"kind": string,
"locked_by": string | null,
"locked_until": string | null,
"max_attempts": number,
"payload": NonNullable<Json>,
"result": Json | null,
"run_at": string,
"status": string,
"workspace_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "engine_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"engine_worker_heartbeat":
{ Args: { "p_info"?: Json,"p_kinds": (string)[],"p_version": string,"p_worker": string }; Returns: undefined
                           },
"exception_rows":
{ Args: { "ws": string }; Returns: Json
                           },
"governance_rows":
{ Args: { "since7": string,"ws": string }; Returns: Json
                           },
"hiring_ops_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"hiring_tick":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"inventory_apply_movement":
{ Args: { "p_by": string,"p_dedupe": string,"p_delta": number,"p_evidence": string,"p_item": string,"p_kind": string,"p_loc": string,"p_reason": string,"p_ref_id": string,"p_ref_label": string,"p_ref_type": string,"p_unit_cost"?: number,"p_ws": string }; Returns: Json
                           },
"invite_preview":
{ Args: { "token": string }; Returns: {
              "email": string,"role": string,"staff_name": string,"state": string,"workspace_name": string
            }[]
                           },
"is_manager":
{ Args: { "ws": string }; Returns: boolean
                           },
"is_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "ws": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"job_ack":
{ Args: { "p_msg_id": number,"p_queue": string }; Returns: boolean
                           },
"job_archive":
{ Args: { "p_error"?: string,"p_msg_id": number,"p_queue": string }; Returns: boolean
                           },
"job_enqueue":
{ Args: { "p_dedupe": string,"p_name": string,"p_payload": Json,"p_queue": string,"p_workspace": string }; Returns: string
                           },
"job_fail":
{ Args: { "p_delay_s": number,"p_error"?: string,"p_msg_id": number,"p_queue": string }; Returns: boolean
                           },
"job_message":
{ Args: { "p_dedupe": string,"p_name": string,"p_outbox": string,"p_payload": Json }; Returns: Json
                           },
"job_read":
{ Args: { "p_qty": number,"p_queue": string,"p_vt": number,"p_ws_limit"?: number }; Returns: {
              "attempt": number,"enqueued_at": string,"message": Json,"msg_id": number
            }[]
                           },
"job_requeue":
{ Args: { "p_outbox": string }; Returns: number
                           },
"job_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"job_touch":
{ Args: { "p_msg_id": number,"p_queue": string,"p_vt": number }; Returns: boolean
                           },
"knowledge_enqueue_source":
{ Args: { "p_kind": string,"p_meta": Json,"p_storage_path": string,"p_title": string,"p_url": string,"p_workspace": string }; Returns: string
                           },
"knowledge_fold":
{ Args: { "t": string }; Returns: string
                           },
"knowledge_retry_source":
{ Args: { "p_source": string }; Returns: string
                           },
"lead_actor_name":
{ Args: { "p_workspace": string }; Returns: string
                           },
"lead_step_json":
{ Args: { "r": Database["public"]['Tables']["responsibilities"]['Row'] }; Returns: Json
                           },
"lead_step_owner":
{ Args: { "p_actor": string,"p_owner": string,"p_workspace": string }; Returns: Record<string, unknown>
                           },
"loyalty_post":
{ Args: { "p_amount_vnd"?: number,"p_by": string,"p_customer": string,"p_evidence"?: string,"p_expires_at"?: string,"p_invoice_id"?: string,"p_kind": string,"p_occurred_at"?: string,"p_order_id"?: string,"p_points": number,"p_ref": string,"p_reward_id"?: string,"p_work_item_id"?: string,"p_workspace": string }; Returns: string
                           },
"match_knowledge":
{ Args: { "p_audience"?: string,"p_installation"?: string,"p_limit"?: number,"p_module": string,"p_query"?: string,"p_query_embedding"?: string,"p_query_model"?: string,"p_workspace": string }; Returns: {
              "content": string,"id": string,"kind": string,"layer": string,"module": string,"score": number,"source_id": string,"title": string,"topic": string,"visibility": string
            }[]
                           },
"member_role":
{ Args: { "ws": string }; Returns: string
                           },
"module_type_name":
{ Args: { "p_key": string }; Returns: string
                           },
"my_sessions":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"ip": string,"last_active_at": string,"user_agent": string
            }[]
                           },
"my_staff_id":
{ Args: { "ws": string }; Returns: string
                           },
"n8n_schedule_pipelines":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"n8n_start_run":
{ Args: { "p_api_base"?: string,"p_data"?: Json,"p_dedupe"?: string,"p_force"?: boolean,"p_key": string,"p_workspace": string }; Returns: string
                           },
"office_data":
{ Args: { "since7": string,"ws": string }; Returns: Json
                           },
"owns_workspace":
{ Args: { "ws": string }; Returns: boolean
                           },
"payment_order_request":
{ Args: { "p_kind": string,"p_target": string,"p_workspace": string }; Returns: string
                           },
"post_office_notice":
{ Args: { "p_body": string,"p_workspace": string }; Returns: undefined
                           },
"promo_state":
{ Args: { "founding_from": string,"founding_to": string,"ws": string }; Returns: Json
                           },
"read_app_command":
{ Args: { "p_id": string }; Returns: Json
                           },
"record_lead_outcome":
{ Args: { "p_evidence": string,"p_lead": string,"p_locale"?: string,"p_stage": string,"p_workspace": string }; Returns: Json
                           },
"request_admin_invite_resend":
{ Args: { "p_invite": string,"p_workspace": string }; Returns: string
                           },
"request_agent_sync":
{ Args: { "p_force"?: boolean,"p_installation"?: string,"p_workspace": string }; Returns: string
                           },
"request_execution_decision":
{ Args: { "p_decision": string,"p_edited_draft"?: string,"p_execution": string,"p_locale"?: string,"p_workspace": string }; Returns: string
                           },
"request_invite_command":
{ Args: { "p_action": string,"p_email"?: string,"p_invite"?: string,"p_role"?: string,"p_staff"?: string,"p_workspace": string }; Returns: string
                           },
"request_office_confirm":
{ Args: { "p_candidate": string,"p_locale"?: string,"p_workspace": string }; Returns: string
                           },
"request_office_propose":
{ Args: { "p_locale"?: string,"p_message": string,"p_workspace": string }; Returns: string
                           },
"request_video_render":
{ Args: { "p_project": string }; Returns: string
                           },
"request_work_decision":
{ Args: { "p_basis"?: string,"p_decision": string,"p_edits"?: Json,"p_locale"?: string,"p_note"?: string,"p_work_item": string,"p_workspace": string }; Returns: string
                           },
"resolve_installation":
{ Args: { "p_chain"?: string,"p_conversation"?: string,"p_lead"?: string,"p_module": string,"p_ws": string }; Returns: {
              "installation_id": string,"via": string
            }[]
                           },
"responsibility_rows":
{ Args: { "ws": string }; Returns: Json
                           },
"revoke_my_session":
{ Args: { "session_id": string }; Returns: boolean
                           },
"revoke_workspace_invite":
{ Args: { "p_invite": string,"p_workspace": string }; Returns: undefined
                           },
"session_bootstrap":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"settle_credit_topups":
{ Args: { "p_force"?: boolean,"p_workspace": string }; Returns: number
                           },
"settle_payment_order":
{ Args: { "p_amount": number,"p_order_code": string,"p_sepay_id": number }; Returns: string
                           },
"shell_data":
{ Args: { "founding_from": string,"founding_to": string,"ws": string }; Returns: Json
                           },
"shifts_my_profile":
{ Args: { "ws": string }; Returns: string
                           },
"storage_ws_manager":
{ Args: { "p_name": string }; Returns: boolean
                           },
"storage_ws_member":
{ Args: { "p_name": string }; Returns: boolean
                           },
"update_my_profile":
{ Args: { "new_display_name": string,"ws": string }; Returns: undefined
                           },
"usage_notice_post":
{ Args: { "p_body": string,"p_level": string,"p_period": string,"p_workspace": string }; Returns: boolean
                           },
"usage_quota_status":
{ Args: { "p_workspace": string }; Returns: {
              "cost_usd": number,"credits_carried": number,"credits_limit": number,"credits_used": number,"fallback_reply": string,"messages_limit": number,"messages_used": number,"period_start": string,"tokens_limit": number,"tokens_used": number,"topup_balance": number
            }[]
                           },
"video_renders_reap":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"workspace_member_contacts":
{ Args: { "p_workspace": string }; Returns: {
              "email": string,"last_sign_in_at": string,"user_id": string
            }[]
                           },
"workspace_members_directory":
{ Args: { "ws": string }; Returns: {
              "created_at": string,"display_name": string,"email": string,"last_sign_in_at": string,"role": string,"staff_id": string,"status": string,"user_id": string
            }[]
                           },
"zalo_authorization_return":
{ Args: { "p_code": string,"p_oa_id"?: string,"p_state": string }; Returns: string
                           },
"zalo_refresh_tick":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"zalo_wizard_begin":
{ Args: { "p_connection": string }; Returns: string
                           },
"zalo_wizard_oa_secret":
{ Args: { "p_connection": string; "p_oa_secret": string }; Returns: string
                           },
"zalo_wizard_start":
{ Args: { "p_app_id": string; "p_app_secret": string; "p_name": string; "p_workspace": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

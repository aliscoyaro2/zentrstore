export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          created_at: string | null
          formatted: string | null
          id: string
          is_default: boolean | null
          label: string | null
          lat: number
          lng: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          formatted?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          lat: number
          lng: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          formatted?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          lat?: number
          lng?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          resolved_at: string | null
          rider_id: string | null
          status: Database["public"]["Enums"]["incident_status"]
          type: Database["public"]["Enums"]["incident_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          resolved_at?: string | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          type: Database["public"]["Enums"]["incident_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          resolved_at?: string | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          type?: Database["public"]["Enums"]["incident_type"]
        }
        Relationships: [
          {
            foreignKeyName: "incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger: {
        Row: {
          amount_kobo: number
          created_at: string | null
          from_party: string
          id: string
          order_id: string | null
          to_party: string
          type: Database["public"]["Enums"]["ledger_entry_type"]
        }
        Insert: {
          amount_kobo: number
          created_at?: string | null
          from_party: string
          id?: string
          order_id?: string | null
          to_party: string
          type: Database["public"]["Enums"]["ledger_entry_type"]
        }
        Update: {
          amount_kobo?: number
          created_at?: string | null
          from_party?: string
          id?: string
          order_id?: string | null
          to_party?: string
          type?: Database["public"]["Enums"]["ledger_entry_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_balances: {
        Row: {
          balance_kobo: number
          last_settled_at: string | null
          merchant_id: string
        }
        Insert: {
          balance_kobo?: number
          last_settled_at?: string | null
          merchant_id: string
        }
        Update: {
          balance_kobo?: number
          last_settled_at?: string | null
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_balances_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          address_text: string | null
          business_name: string
          category: Database["public"]["Enums"]["merchant_category"]
          closing_time: string | null
          commission_pct: number
          created_at: string | null
          delivery_radius_km: number
          id: string
          is_open_override: boolean | null
          lat: number
          lng: number
          opening_time: string | null
          owner_id: string | null
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          address_text?: string | null
          business_name: string
          category: Database["public"]["Enums"]["merchant_category"]
          closing_time?: string | null
          commission_pct: number
          created_at?: string | null
          delivery_radius_km?: number
          id?: string
          is_open_override?: boolean | null
          lat: number
          lng: number
          opening_time?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          address_text?: string | null
          business_name?: string
          category?: Database["public"]["Enums"]["merchant_category"]
          closing_time?: string | null
          commission_pct?: number
          created_at?: string | null
          delivery_radius_km?: number
          id?: string
          is_open_override?: boolean | null
          lat?: number
          lng?: number
          opening_time?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "merchants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number
          unit_price_kobo: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity: number
          unit_price_kobo: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number
          unit_price_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          note: string | null
          order_id: string | null
          status: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          status: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_fee_kobo: number
          id: string
          merchant_id: string | null
          paid_at: string | null
          payment_reference: string
          placed_at: string | null
          rider_id: string | null
          service_fee_kobo: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kobo: number
          total_kobo: number
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_fee_kobo: number
          id?: string
          merchant_id?: string | null
          paid_at?: string | null
          payment_reference: string
          placed_at?: string | null
          rider_id?: string | null
          service_fee_kobo: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kobo: number
          total_kobo: number
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_fee_kobo?: number
          id?: string
          merchant_id?: string | null
          paid_at?: string | null
          payment_reference?: string
          placed_at?: string | null
          rider_id?: string | null
          service_fee_kobo?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kobo?: number
          total_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_kobo: number
          authorization_code: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          gateway: string | null
          gateway_reference: string
          id: string
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_fee_kobo: number | null
          verified_at: string | null
        }
        Insert: {
          amount_kobo: number
          authorization_code?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          gateway?: string | null
          gateway_reference: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_fee_kobo?: number | null
          verified_at?: string | null
        }
        Update: {
          amount_kobo?: number
          authorization_code?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          gateway?: string | null
          gateway_reference?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_fee_kobo?: number | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_available: boolean | null
          merchant_id: string | null
          name: string
          photo_url: string | null
          prep_time_mins: number
          price_kobo: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          merchant_id?: string | null
          name: string
          photo_url?: string | null
          prep_time_mins?: number
          price_kobo: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean | null
          merchant_id?: string | null
          name?: string
          photo_url?: string | null
          prep_time_mins?: number
          price_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      rider_balances: {
        Row: {
          balance_kobo: number
          last_settled_at: string | null
          rider_id: string
        }
        Insert: {
          balance_kobo?: number
          last_settled_at?: string | null
          rider_id: string
        }
        Update: {
          balance_kobo?: number
          last_settled_at?: string | null
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_balances_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          id: string
          is_online: boolean | null
          last_location_at: string | null
          national_id_doc_url: string | null
          photo_url: string | null
          plate_number: string | null
          rating_avg: number | null
          status: Database["public"]["Enums"]["approval_status"]
          total_deliveries: number | null
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Insert: {
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          id: string
          is_online?: boolean | null
          last_location_at?: string | null
          national_id_doc_url?: string | null
          photo_url?: string | null
          plate_number?: string | null
          rating_avg?: number | null
          status?: Database["public"]["Enums"]["approval_status"]
          total_deliveries?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Update: {
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          is_online?: boolean | null
          last_location_at?: string | null
          national_id_doc_url?: string | null
          photo_url?: string | null
          plate_number?: string | null
          rating_avg?: number | null
          status?: Database["public"]["Enums"]["approval_status"]
          total_deliveries?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "riders_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          boundary: Json | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          boundary?: Json | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          boundary?: Json | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      approval_status: "pending" | "approved" | "suspended"
      incident_status: "open" | "in_progress" | "resolved"
      incident_type:
        | "breakdown"
        | "accident"
        | "merchant_not_ready"
        | "customer_unreachable"
        | "security"
      ledger_entry_type:
        | "order_payment"
        | "merchant_settlement"
        | "rider_earnings"
        | "commission"
        | "refund"
        | "delivery_margin"
        | "service_fee"
      merchant_category:
        | "restaurant"
        | "home_kitchen"
        | "bakery"
        | "grocery"
        | "pharmacy"
        | "electronics"
        | "fashion"
        | "cosmetics"
        | "meat"
        | "hardware"
        | "water"
        | "gas"
        | "courier"
        | "office_supplies"
      order_status:
        | "placed"
        | "paid"
        | "merchant_accepted"
        | "preparing"
        | "rider_assigned"
        | "rider_en_route_to_merchant"
        | "picked_up"
        | "rider_en_route_to_customer"
        | "delivered"
        | "cancelled"
        | "refunded"
      payment_status:
        | "pending"
        | "authorized"
        | "verified"
        | "paid"
        | "refunded"
        | "failed"
        | "cancelled"
      user_role: "customer" | "merchant" | "rider" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pending", "approved", "suspended"],
      incident_status: ["open", "in_progress", "resolved"],
      incident_type: [
        "breakdown",
        "accident",
        "merchant_not_ready",
        "customer_unreachable",
        "security",
      ],
      ledger_entry_type: [
        "order_payment",
        "merchant_settlement",
        "rider_earnings",
        "commission",
        "refund",
        "delivery_margin",
        "service_fee",
      ],
      merchant_category: [
        "restaurant",
        "home_kitchen",
        "bakery",
        "grocery",
        "pharmacy",
        "electronics",
        "fashion",
        "cosmetics",
        "meat",
        "hardware",
        "water",
        "gas",
        "courier",
        "office_supplies",
      ],
      order_status: [
        "placed",
        "paid",
        "merchant_accepted",
        "preparing",
        "rider_assigned",
        "rider_en_route_to_merchant",
        "picked_up",
        "rider_en_route_to_customer",
        "delivered",
        "cancelled",
        "refunded",
      ],
      payment_status: [
        "pending",
        "authorized",
        "verified",
        "paid",
        "refunded",
        "failed",
        "cancelled",
      ],
      user_role: ["customer", "merchant", "rider", "admin"],
    },
  },
} as const

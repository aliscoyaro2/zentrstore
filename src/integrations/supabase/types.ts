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
      admin_users: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role"]
          created_at: string | null
          id: string
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string | null
          id: string
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          created_at: string
          id: string
          incident_id: string | null
          order_id: string
          reason: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id?: string | null
          order_id: string
          reason?: string | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string | null
          order_id?: string
          reason?: string | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      merchant_applications: {
        Row: {
          account_name: string | null
          account_number: string | null
          address_text: string | null
          agreement_accepted_at: string | null
          agreement_signature_name: string | null
          bank_name: string | null
          business_description: string | null
          business_name: string | null
          category: Database["public"]["Enums"]["merchant_category"] | null
          closing_time: string | null
          commission_agreement_accepted: boolean
          cover_photo_url: string | null
          created_at: string
          email: string
          email_verified_at: string | null
          id: string
          lga: string | null
          opening_time: string | null
          owner_id_doc_url: string | null
          phone: string | null
          pos_available: boolean | null
          prep_time_mins: number | null
          promoted_merchant_id: string | null
          referral_source: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          self_delivery: boolean | null
          status: Database["public"]["Enums"]["merchant_application_status"]
          tin: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          address_text?: string | null
          agreement_accepted_at?: string | null
          agreement_signature_name?: string | null
          bank_name?: string | null
          business_description?: string | null
          business_name?: string | null
          category?: Database["public"]["Enums"]["merchant_category"] | null
          closing_time?: string | null
          commission_agreement_accepted?: boolean
          cover_photo_url?: string | null
          created_at?: string
          email: string
          email_verified_at?: string | null
          id?: string
          lga?: string | null
          opening_time?: string | null
          owner_id_doc_url?: string | null
          phone?: string | null
          pos_available?: boolean | null
          prep_time_mins?: number | null
          promoted_merchant_id?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          self_delivery?: boolean | null
          status?: Database["public"]["Enums"]["merchant_application_status"]
          tin?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          address_text?: string | null
          agreement_accepted_at?: string | null
          agreement_signature_name?: string | null
          bank_name?: string | null
          business_description?: string | null
          business_name?: string | null
          category?: Database["public"]["Enums"]["merchant_category"] | null
          closing_time?: string | null
          commission_agreement_accepted?: boolean
          cover_photo_url?: string | null
          created_at?: string
          email?: string
          email_verified_at?: string | null
          id?: string
          lga?: string | null
          opening_time?: string | null
          owner_id_doc_url?: string | null
          phone?: string | null
          pos_available?: boolean | null
          prep_time_mins?: number | null
          promoted_merchant_id?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          self_delivery?: boolean | null
          status?: Database["public"]["Enums"]["merchant_application_status"]
          tin?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_applications_promoted_merchant_id_fkey"
            columns: ["promoted_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          business_description: string | null
          business_name: string
          cac_doc_url: string | null
          category: Database["public"]["Enums"]["merchant_category"]
          closing_time: string | null
          commission_pct: number
          cover_photo_url: string | null
          created_at: string | null
          delivery_radius_km: number
          id: string
          is_open_override: boolean | null
          lat: number
          lng: number
          opening_time: string | null
          owner_id: string | null
          phone: string | null
          pos_available: boolean
          prep_time_mins: number | null
          rejection_reason: string | null
          self_delivery: boolean
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          address_text?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_description?: string | null
          business_name: string
          cac_doc_url?: string | null
          category: Database["public"]["Enums"]["merchant_category"]
          closing_time?: string | null
          commission_pct: number
          cover_photo_url?: string | null
          created_at?: string | null
          delivery_radius_km?: number
          id?: string
          is_open_override?: boolean | null
          lat: number
          lng: number
          opening_time?: string | null
          owner_id?: string | null
          phone?: string | null
          pos_available?: boolean
          prep_time_mins?: number | null
          rejection_reason?: string | null
          self_delivery?: boolean
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          address_text?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_description?: string | null
          business_name?: string
          cac_doc_url?: string | null
          category?: Database["public"]["Enums"]["merchant_category"]
          closing_time?: string | null
          commission_pct?: number
          cover_photo_url?: string | null
          created_at?: string | null
          delivery_radius_km?: number
          id?: string
          is_open_override?: boolean | null
          lat?: number
          lng?: number
          opening_time?: string | null
          owner_id?: string | null
          phone?: string | null
          pos_available?: boolean
          prep_time_mins?: number | null
          rejection_reason?: string | null
          self_delivery?: boolean
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
      notifications_log: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string | null
          id: string
          recipient_count: number | null
          sent_by: string | null
          target: Database["public"]["Enums"]["notification_target"]
          title: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string | null
          id?: string
          recipient_count?: number | null
          sent_by?: string | null
          target: Database["public"]["Enums"]["notification_target"]
          title?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string | null
          id?: string
          recipient_count?: number | null
          sent_by?: string | null
          target?: Database["public"]["Enums"]["notification_target"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_sent_by_fkey"
            columns: ["sent_by"]
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
      order_offers: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          offered_at: string
          order_id: string
          responded_at: string | null
          rider_id: string
          status: Database["public"]["Enums"]["offer_status"]
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          offered_at?: string
          order_id: string
          responded_at?: string | null
          rider_id: string
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          offered_at?: string
          order_id?: string
          responded_at?: string | null
          rider_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_offers_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
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
          batch_id: string | null
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
          rider_assigned_at: string | null
          rider_id: string | null
          service_fee_kobo: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kobo: number
          total_kobo: number
        }
        Insert: {
          batch_id?: string | null
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
          rider_assigned_at?: string | null
          rider_id?: string | null
          service_fee_kobo: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kobo: number
          total_kobo: number
        }
        Update: {
          batch_id?: string | null
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
          rider_assigned_at?: string | null
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
      platform_settings: {
        Row: {
          base_delivery_fee_kobo: number
          default_commission_pct: number
          id: boolean
          per_km_fee_kobo: number
          platform_currency: string
          service_fee_min_kobo: number
          service_fee_pct: number
          support_email: string | null
          support_phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_delivery_fee_kobo?: number
          default_commission_pct?: number
          id?: boolean
          per_km_fee_kobo?: number
          platform_currency?: string
          service_fee_min_kobo?: number
          service_fee_pct?: number
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_delivery_fee_kobo?: number
          default_commission_pct?: number
          id?: boolean
          per_km_fee_kobo?: number
          platform_currency?: string
          service_fee_min_kobo?: number
          service_fee_pct?: number
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          blocked_reason: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_blocked?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          is_hidden: boolean | null
          merchant_id: string | null
          order_id: string | null
          rating: number
          rider_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_hidden?: boolean | null
          merchant_id?: string | null
          order_id?: string | null
          rating: number
          rider_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_hidden?: boolean | null
          merchant_id?: string | null
          order_id?: string | null
          rating?: number
          rider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_applications: {
        Row: {
          account_name: string | null
          account_number: string | null
          agreement_accepted_at: string | null
          agreement_signature_name: string | null
          bank_name: string | null
          created_at: string
          criminal_record_details: string | null
          date_of_birth: string | null
          drivers_license_back_url: string | null
          drivers_license_front_url: string | null
          drivers_license_number: string | null
          email: string
          email_verified_at: string | null
          full_name: string | null
          gender: string | null
          has_criminal_record: boolean | null
          id: string
          lga: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          phone: string | null
          photo_url: string | null
          plate_number: string | null
          previous_delivery_experience: string | null
          promoted_rider_id: string | null
          referral_source: string | null
          rejection_reason: string | null
          residential_address: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["rider_application_status"]
          updated_at: string
          vehicle_insurance_url: string | null
          vehicle_ownership: string | null
          vehicle_type: string | null
          years_riding_experience: number | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          agreement_accepted_at?: string | null
          agreement_signature_name?: string | null
          bank_name?: string | null
          created_at?: string
          criminal_record_details?: string | null
          date_of_birth?: string | null
          drivers_license_back_url?: string | null
          drivers_license_front_url?: string | null
          drivers_license_number?: string | null
          email: string
          email_verified_at?: string | null
          full_name?: string | null
          gender?: string | null
          has_criminal_record?: boolean | null
          id?: string
          lga?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          phone?: string | null
          photo_url?: string | null
          plate_number?: string | null
          previous_delivery_experience?: string | null
          promoted_rider_id?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          residential_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["rider_application_status"]
          updated_at?: string
          vehicle_insurance_url?: string | null
          vehicle_ownership?: string | null
          vehicle_type?: string | null
          years_riding_experience?: number | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          agreement_accepted_at?: string | null
          agreement_signature_name?: string | null
          bank_name?: string | null
          created_at?: string
          criminal_record_details?: string | null
          date_of_birth?: string | null
          drivers_license_back_url?: string | null
          drivers_license_front_url?: string | null
          drivers_license_number?: string | null
          email?: string
          email_verified_at?: string | null
          full_name?: string | null
          gender?: string | null
          has_criminal_record?: boolean | null
          id?: string
          lga?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          phone?: string | null
          photo_url?: string | null
          plate_number?: string | null
          previous_delivery_experience?: string | null
          promoted_rider_id?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          residential_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["rider_application_status"]
          updated_at?: string
          vehicle_insurance_url?: string | null
          vehicle_ownership?: string | null
          vehicle_type?: string | null
          years_riding_experience?: number | null
        }
        Relationships: []
      }
      rider_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string | null
          rider_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          rider_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_audit_log_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
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
          acceptance_rate: number
          account_name: string | null
          account_number: string | null
          agreement_accepted_at: string | null
          agreement_signature_name: string | null
          application_id: string | null
          bank_name: string | null
          consecutive_missed_offers: number
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          date_of_birth: string | null
          drivers_license_back_url: string | null
          drivers_license_front_url: string | null
          drivers_license_number: string | null
          gender: string | null
          id: string
          is_online: boolean | null
          last_location_at: string | null
          lga: string | null
          national_id_doc_url: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          phone: string | null
          photo_url: string | null
          plate_number: string | null
          rating_avg: number | null
          referral_source: string | null
          residential_address: string | null
          status: Database["public"]["Enums"]["approval_status"]
          total_deliveries: number | null
          vehicle_insurance_url: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_ownership: string | null
          years_riding_experience: number | null
        }
        Insert: {
          acceptance_rate?: number
          account_name?: string | null
          account_number?: string | null
          agreement_accepted_at?: string | null
          agreement_signature_name?: string | null
          application_id?: string | null
          bank_name?: string | null
          consecutive_missed_offers?: number
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          date_of_birth?: string | null
          drivers_license_back_url?: string | null
          drivers_license_front_url?: string | null
          drivers_license_number?: string | null
          gender?: string | null
          id: string
          is_online?: boolean | null
          last_location_at?: string | null
          lga?: string | null
          national_id_doc_url?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          phone?: string | null
          photo_url?: string | null
          plate_number?: string | null
          rating_avg?: number | null
          referral_source?: string | null
          residential_address?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          total_deliveries?: number | null
          vehicle_insurance_url?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_ownership?: string | null
          years_riding_experience?: number | null
        }
        Update: {
          acceptance_rate?: number
          account_name?: string | null
          account_number?: string | null
          agreement_accepted_at?: string | null
          agreement_signature_name?: string | null
          application_id?: string | null
          bank_name?: string | null
          consecutive_missed_offers?: number
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          date_of_birth?: string | null
          drivers_license_back_url?: string | null
          drivers_license_front_url?: string | null
          drivers_license_number?: string | null
          gender?: string | null
          id?: string
          is_online?: boolean | null
          last_location_at?: string | null
          lga?: string | null
          national_id_doc_url?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          phone?: string | null
          photo_url?: string | null
          plate_number?: string | null
          rating_avg?: number | null
          referral_source?: string | null
          residential_address?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          total_deliveries?: number | null
          vehicle_insurance_url?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_ownership?: string | null
          years_riding_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "riders_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rider_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riders_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount_kobo: number
          bank_reference: string | null
          created_at: string | null
          id: string
          initiated_by: string | null
          merchant_id: string | null
          paid_at: string | null
          party_type: Database["public"]["Enums"]["settlement_party"]
          rider_id: string | null
          status: Database["public"]["Enums"]["settlement_status"]
        }
        Insert: {
          amount_kobo: number
          bank_reference?: string | null
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          merchant_id?: string | null
          paid_at?: string | null
          party_type: Database["public"]["Enums"]["settlement_party"]
          rider_id?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
        }
        Update: {
          amount_kobo?: number
          bank_reference?: string | null
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          merchant_id?: string | null
          paid_at?: string | null
          party_type?: Database["public"]["Enums"]["settlement_party"]
          rider_id?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
        }
        Relationships: [
          {
            foreignKeyName: "settlements_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string | null
          id: string
          order_id: string | null
          requester_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string | null
          id?: string
          order_id?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string | null
          id?: string
          order_id?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          sender_id: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          boundary: Json | null
          created_at: string | null
          delivery_fee_kobo: number | null
          estimated_minutes: number | null
          id: string
          is_active: boolean | null
          lat: number | null
          lng: number | null
          max_radius_km: number | null
          minimum_order_kobo: number
          name: string
        }
        Insert: {
          boundary?: Json | null
          created_at?: string | null
          delivery_fee_kobo?: number | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          max_radius_km?: number | null
          minimum_order_kobo?: number
          name: string
        }
        Update: {
          boundary?: Json | null
          created_at?: string | null
          delivery_fee_kobo?: number | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          max_radius_km?: number | null
          minimum_order_kobo?: number
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_order_offer: { Args: { p_offer_id: string }; Returns: boolean }
      admin_review_cancellation: {
        Args: { p_approve: boolean; p_note: string; p_request_id: string }
        Returns: undefined
      }
      decline_order_offer: { Args: { p_offer_id: string }; Returns: undefined }
      dispatch_order: { Args: { p_order_id: string }; Returns: string }
      expire_and_reassign_offers: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      log_rider_arrival: {
        Args: { p_leg: string; p_order_id: string }
        Returns: undefined
      }
      request_order_cancellation: {
        Args: { p_order_id: string; p_reason: string }
        Returns: string
      }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "operations_manager"
        | "support_agent"
        | "finance_officer"
        | "merchant_manager"
        | "rider_manager"
        | "marketing_manager"
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
      merchant_application_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
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
      notification_channel: "push" | "sms" | "whatsapp" | "email"
      notification_target: "customers" | "merchants" | "riders" | "everyone"
      offer_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
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
      rider_application_status: "draft" | "submitted" | "approved" | "rejected"
      settlement_party: "merchant" | "rider"
      settlement_status: "pending" | "processing" | "paid" | "failed"
      ticket_category: "customer" | "merchant" | "rider" | "payment" | "other"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      admin_role: [
        "super_admin",
        "operations_manager",
        "support_agent",
        "finance_officer",
        "merchant_manager",
        "rider_manager",
        "marketing_manager",
      ],
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
      merchant_application_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
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
      notification_channel: ["push", "sms", "whatsapp", "email"],
      notification_target: ["customers", "merchants", "riders", "everyone"],
      offer_status: ["pending", "accepted", "declined", "expired", "cancelled"],
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
      rider_application_status: ["draft", "submitted", "approved", "rejected"],
      settlement_party: ["merchant", "rider"],
      settlement_status: ["pending", "processing", "paid", "failed"],
      ticket_category: ["customer", "merchant", "rider", "payment", "other"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      user_role: ["customer", "merchant", "rider", "admin"],
    },
  },
} as const

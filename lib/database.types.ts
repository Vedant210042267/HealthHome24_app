// AUTO-GENERATED from the HealthHome24 PostgreSQL schema. Do not edit by hand.
// Regenerate with: npx supabase gen types typescript --project-id <ref> > lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
      advance_recoveries: {
        Row: {
          id: string
          advance_id: string
          payroll_item_id: string | null
          recovery_date: string
          amount: number
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          advance_id: string
          payroll_item_id?: string | null
          recovery_date?: string
          amount: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          advance_id?: string
          payroll_item_id?: string | null
          recovery_date?: string
          amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_recoveries_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "staff_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_recoveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_recoveries_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          id: string
          duty_allocation_id: string
          staff_id: string
          patient_id: string
          duty_date: string
          visit_sequence: number
          shift_slot: Database["public"]["Enums"]["shift_slot"]
          status: Database["public"]["Enums"]["attendance_status"]
          check_in_at: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_accuracy_m: number | null
          check_in_source: Database["public"]["Enums"]["check_in_source"]
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_accuracy_m: number | null
          check_out_source: Database["public"]["Enums"]["check_in_source"] | null
          overtime_hours: number
          patient_rate_applied: number
          staff_wage_applied: number
          ot_hourly_rate_applied: number
          is_billable: boolean
          is_replacement: boolean
          replacement_staff_id: string | null
          leave_request_id: string | null
          notes: string | null
          marked_by: string | null
          verified_by: string | null
          verified_at: string | null
          created_at: string
          updated_at: string
          patient_units: number | null
          staff_units: number | null
        }
        Insert: {
          id?: string
          duty_allocation_id: string
          staff_id: string
          patient_id: string
          duty_date: string
          visit_sequence?: number
          shift_slot?: Database["public"]["Enums"]["shift_slot"]
          status?: Database["public"]["Enums"]["attendance_status"]
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_accuracy_m?: number | null
          check_in_source?: Database["public"]["Enums"]["check_in_source"]
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_accuracy_m?: number | null
          check_out_source?: Database["public"]["Enums"]["check_in_source"] | null
          overtime_hours?: number
          patient_rate_applied?: number
          staff_wage_applied?: number
          ot_hourly_rate_applied?: number
          is_billable?: boolean
          is_replacement?: boolean
          replacement_staff_id?: string | null
          leave_request_id?: string | null
          notes?: string | null
          marked_by?: string | null
          verified_by?: string | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          duty_allocation_id?: string
          staff_id?: string
          patient_id?: string
          duty_date?: string
          visit_sequence?: number
          shift_slot?: Database["public"]["Enums"]["shift_slot"]
          status?: Database["public"]["Enums"]["attendance_status"]
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_accuracy_m?: number | null
          check_in_source?: Database["public"]["Enums"]["check_in_source"]
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_accuracy_m?: number | null
          check_out_source?: Database["public"]["Enums"]["check_in_source"] | null
          overtime_hours?: number
          patient_rate_applied?: number
          staff_wage_applied?: number
          ot_hourly_rate_applied?: number
          is_billable?: boolean
          is_replacement?: boolean
          replacement_staff_id?: string | null
          leave_request_id?: string | null
          notes?: string | null
          marked_by?: string | null
          verified_by?: string | null
          verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_duty_allocation_id_fkey"
            columns: ["duty_allocation_id"]
            isOneToOne: false
            referencedRelation: "duty_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_replacement_staff_id_fkey"
            columns: ["replacement_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          id: number
          table_name: string
          record_id: string | null
          action: string
          actor_id: string | null
          old_data: Json | null
          new_data: Json | null
          changed_at: string
        }
        Insert: {
          table_name: string
          record_id?: string | null
          action: string
          actor_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          changed_at?: string
        }
        Update: {
          table_name?: string
          record_id?: string | null
          action?: string
          actor_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          changed_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          id: string
          full_name: string
          qualification: string | null
          specialization: string | null
          registration_number: string | null
          hospital_name: string | null
          clinic_address: string | null
          phone: string | null
          alternate_phone: string | null
          email: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          qualification?: string | null
          specialization?: string | null
          registration_number?: string | null
          hospital_name?: string | null
          clinic_address?: string | null
          phone?: string | null
          alternate_phone?: string | null
          email?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          qualification?: string | null
          specialization?: string | null
          registration_number?: string | null
          hospital_name?: string | null
          clinic_address?: string | null
          phone?: string | null
          alternate_phone?: string | null
          email?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      duty_allocations: {
        Row: {
          id: string
          patient_id: string
          staff_id: string
          duty_type: Database["public"]["Enums"]["duty_type"]
          shift_slot: Database["public"]["Enums"]["shift_slot"]
          start_date: string
          end_date: string | null
          patient_daily_rate: number
          staff_daily_wage: number
          ot_hourly_rate: number
          status: Database["public"]["Enums"]["allocation_status"]
          end_reason: string | null
          replaces_allocation_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          staff_id: string
          duty_type: Database["public"]["Enums"]["duty_type"]
          shift_slot?: Database["public"]["Enums"]["shift_slot"]
          start_date: string
          end_date?: string | null
          patient_daily_rate: number
          staff_daily_wage: number
          ot_hourly_rate?: number
          status?: Database["public"]["Enums"]["allocation_status"]
          end_reason?: string | null
          replaces_allocation_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          staff_id?: string
          duty_type?: Database["public"]["Enums"]["duty_type"]
          shift_slot?: Database["public"]["Enums"]["shift_slot"]
          start_date?: string
          end_date?: string | null
          patient_daily_rate?: number
          staff_daily_wage?: number
          ot_hourly_rate?: number
          status?: Database["public"]["Enums"]["allocation_status"]
          end_reason?: string | null
          replaces_allocation_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_allocations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_allocations_replaces_allocation_id_fkey"
            columns: ["replaces_allocation_id"]
            isOneToOne: false
            referencedRelation: "duty_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_allocations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          id: string
          staff_id: string
          from_date: string
          to_date: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          status: Database["public"]["Enums"]["request_status"]
          requested_at: string
          decided_by: string | null
          decided_at: string | null
          decision_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          from_date: string
          to_date: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          requested_at?: string
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          from_date?: string
          to_date?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          requested_at?: string
          decided_by?: string | null
          decided_at?: string | null
          decision_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_expenses: {
        Row: {
          id: string
          expense_date: string
          category: Database["public"]["Enums"]["expense_category"]
          description: string | null
          amount: number
          patient_id: string | null
          staff_id: string | null
          duty_allocation_id: string | null
          paid_to: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          reference: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          expense_date?: string
          category: Database["public"]["Enums"]["expense_category"]
          description?: string | null
          amount: number
          patient_id?: string | null
          staff_id?: string | null
          duty_allocation_id?: string | null
          paid_to?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          reference?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          expense_date?: string
          category?: Database["public"]["Enums"]["expense_category"]
          description?: string | null
          amount?: number
          patient_id?: string | null
          staff_id?: string | null
          duty_allocation_id?: string | null
          paid_to?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          reference?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operating_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operating_expenses_duty_allocation_id_fkey"
            columns: ["duty_allocation_id"]
            isOneToOne: false
            referencedRelation: "duty_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operating_expenses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operating_expenses_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          duty_allocation_id: string | null
          description: string
          hsn_sac: string
          quantity: number
          uom: string
          rate: number
          amount: number | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          duty_allocation_id?: string | null
          description: string
          hsn_sac?: string
          quantity?: number
          uom?: string
          rate?: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          duty_allocation_id?: string | null
          description?: string
          hsn_sac?: string
          quantity?: number
          uom?: string
          rate?: number
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_invoice_lines_duty_allocation_id_fkey"
            columns: ["duty_allocation_id"]
            isOneToOne: false
            referencedRelation: "duty_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "patient_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_invoices: {
        Row: {
          id: string
          invoice_number: string
          patient_id: string
          period_month: string | null
          period_start: string | null
          period_end: string | null
          invoice_date: string
          due_date: string | null
          place_of_supply: string
          supplier_gstin: string | null
          customer_gstin: string | null
          is_gst_exempt: boolean
          gst_exemption_reason: string | null
          subtotal: number
          discount_amount: number
          taxable_value: number
          cgst_rate: number
          cgst_amount: number
          sgst_rate: number
          sgst_amount: number
          igst_rate: number
          igst_amount: number
          tds_rate: number
          tds_amount: number
          advance_adjusted: number
          amount_paid: number
          total_amount: number | null
          net_receivable: number | null
          balance_due: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          issued_at: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string
          patient_id: string
          period_month?: string | null
          period_start?: string | null
          period_end?: string | null
          invoice_date?: string
          due_date?: string | null
          place_of_supply?: string
          supplier_gstin?: string | null
          customer_gstin?: string | null
          is_gst_exempt?: boolean
          gst_exemption_reason?: string | null
          subtotal?: number
          discount_amount?: number
          taxable_value?: number
          cgst_rate?: number
          cgst_amount?: number
          sgst_rate?: number
          sgst_amount?: number
          igst_rate?: number
          igst_amount?: number
          tds_rate?: number
          tds_amount?: number
          advance_adjusted?: number
          amount_paid?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          issued_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          patient_id?: string
          period_month?: string | null
          period_start?: string | null
          period_end?: string | null
          invoice_date?: string
          due_date?: string | null
          place_of_supply?: string
          supplier_gstin?: string | null
          customer_gstin?: string | null
          is_gst_exempt?: boolean
          gst_exemption_reason?: string | null
          subtotal?: number
          discount_amount?: number
          taxable_value?: number
          cgst_rate?: number
          cgst_amount?: number
          sgst_rate?: number
          sgst_amount?: number
          igst_rate?: number
          igst_amount?: number
          tds_rate?: number
          tds_amount?: number
          advance_adjusted?: number
          amount_paid?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          issued_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_payments: {
        Row: {
          id: string
          receipt_number: string
          patient_id: string
          invoice_id: string | null
          direction: Database["public"]["Enums"]["payment_direction"]
          received_on: string
          amount: number
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          reference: string | null
          received_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          receipt_number?: string
          patient_id: string
          invoice_id?: string | null
          direction?: Database["public"]["Enums"]["payment_direction"]
          received_on?: string
          amount: number
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          reference?: string | null
          received_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          receipt_number?: string
          patient_id?: string
          invoice_id?: string | null
          direction?: Database["public"]["Enums"]["payment_direction"]
          received_on?: string
          amount?: number
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          reference?: string | null
          received_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "patient_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          id: string
          patient_code: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          date_of_birth: string | null
          age_years: number | null
          address_line1: string
          address_line2: string | null
          landmark: string | null
          area: string | null
          city: string
          state: string
          pincode: string | null
          latitude: number | null
          longitude: number | null
          geofence_radius_m: number
          primary_contact_name: string
          primary_contact_phone: string
          primary_contact_relation: string | null
          family_contact_name: string | null
          family_contact_phone: string | null
          family_contact_relation: string | null
          referring_doctor_id: string | null
          treating_doctor_id: string | null
          doctor_notes: string | null
          diagnosis: string | null
          care_requirements: string | null
          mobility_status: string | null
          allergies: string | null
          current_medications: string | null
          attendant_gender_pref: Database["public"]["Enums"]["gender"] | null
          language_preference: string[] | null
          service_type: Database["public"]["Enums"]["service_type"]
          default_daily_rate: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          security_deposit: number
          gst_applicable: boolean
          customer_gstin: string | null
          start_date: string
          end_date: string | null
          status: Database["public"]["Enums"]["patient_status"]
          discharge_reason: string | null
          referral_source: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_code?: string
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          date_of_birth?: string | null
          age_years?: number | null
          address_line1: string
          address_line2?: string | null
          landmark?: string | null
          area?: string | null
          city?: string
          state?: string
          pincode?: string | null
          latitude?: number | null
          longitude?: number | null
          geofence_radius_m?: number
          primary_contact_name: string
          primary_contact_phone: string
          primary_contact_relation?: string | null
          family_contact_name?: string | null
          family_contact_phone?: string | null
          family_contact_relation?: string | null
          referring_doctor_id?: string | null
          treating_doctor_id?: string | null
          doctor_notes?: string | null
          diagnosis?: string | null
          care_requirements?: string | null
          mobility_status?: string | null
          allergies?: string | null
          current_medications?: string | null
          attendant_gender_pref?: Database["public"]["Enums"]["gender"] | null
          language_preference?: string[] | null
          service_type: Database["public"]["Enums"]["service_type"]
          default_daily_rate: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          security_deposit?: number
          gst_applicable?: boolean
          customer_gstin?: string | null
          start_date?: string
          end_date?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          discharge_reason?: string | null
          referral_source?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_code?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          date_of_birth?: string | null
          age_years?: number | null
          address_line1?: string
          address_line2?: string | null
          landmark?: string | null
          area?: string | null
          city?: string
          state?: string
          pincode?: string | null
          latitude?: number | null
          longitude?: number | null
          geofence_radius_m?: number
          primary_contact_name?: string
          primary_contact_phone?: string
          primary_contact_relation?: string | null
          family_contact_name?: string | null
          family_contact_phone?: string | null
          family_contact_relation?: string | null
          referring_doctor_id?: string | null
          treating_doctor_id?: string | null
          doctor_notes?: string | null
          diagnosis?: string | null
          care_requirements?: string | null
          mobility_status?: string | null
          allergies?: string | null
          current_medications?: string | null
          attendant_gender_pref?: Database["public"]["Enums"]["gender"] | null
          language_preference?: string[] | null
          service_type?: Database["public"]["Enums"]["service_type"]
          default_daily_rate?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          security_deposit?: number
          gst_applicable?: boolean
          customer_gstin?: string | null
          start_date?: string
          end_date?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          discharge_reason?: string | null
          referral_source?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_referring_doctor_id_fkey"
            columns: ["referring_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_treating_doctor_id_fkey"
            columns: ["treating_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustments: {
        Row: {
          id: string
          staff_id: string
          period_month: string
          kind: Database["public"]["Enums"]["adjustment_kind"]
          category: string
          amount: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          period_month: string
          kind: Database["public"]["Enums"]["adjustment_kind"]
          category: string
          amount: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          period_month?: string
          kind?: Database["public"]["Enums"]["adjustment_kind"]
          category?: string
          amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          id: string
          payroll_run_id: string
          staff_id: string
          period_month: string
          days_present: number
          half_days: number
          days_absent: number
          paid_leave_days: number
          replacement_duties: number
          payable_units: number
          overtime_hours: number
          gross_wage: number
          overtime_amount: number
          additions: number
          other_deductions: number
          advance_recovery: number
          net_payable: number | null
          payment_status: Database["public"]["Enums"]["payslip_payment_status"]
          paid_amount: number
          paid_at: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          payment_reference: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payroll_run_id: string
          staff_id: string
          period_month: string
          days_present?: number
          half_days?: number
          days_absent?: number
          paid_leave_days?: number
          replacement_duties?: number
          payable_units?: number
          overtime_hours?: number
          gross_wage?: number
          overtime_amount?: number
          additions?: number
          other_deductions?: number
          advance_recovery?: number
          payment_status?: Database["public"]["Enums"]["payslip_payment_status"]
          paid_amount?: number
          paid_at?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          payment_reference?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payroll_run_id?: string
          staff_id?: string
          period_month?: string
          days_present?: number
          half_days?: number
          days_absent?: number
          paid_leave_days?: number
          replacement_duties?: number
          payable_units?: number
          overtime_hours?: number
          gross_wage?: number
          overtime_amount?: number
          additions?: number
          other_deductions?: number
          advance_recovery?: number
          payment_status?: Database["public"]["Enums"]["payslip_payment_status"]
          paid_amount?: number
          paid_at?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          payment_reference?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          id: string
          period_month: string
          status: Database["public"]["Enums"]["payroll_status"]
          total_gross: number
          total_deductions: number
          total_net: number
          staff_count: number
          notes: string | null
          generated_at: string
          approved_by: string | null
          approved_at: string | null
          paid_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          period_month: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_gross?: number
          total_deductions?: number
          total_net?: number
          staff_count?: number
          notes?: string | null
          generated_at?: string
          approved_by?: string | null
          approved_at?: string | null
          paid_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          period_month?: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_gross?: number
          total_deductions?: number
          total_net?: number
          staff_count?: number
          notes?: string | null
          generated_at?: string
          approved_by?: string | null
          approved_at?: string | null
          paid_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          role: Database["public"]["Enums"]["user_role"]
          phone: string | null
          staff_id: string | null
          is_active: boolean
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: Database["public"]["Enums"]["user_role"]
          phone?: string | null
          staff_id?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: Database["public"]["Enums"]["user_role"]
          phone?: string | null
          staff_id?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          id: string
          staff_code: string
          full_name: string
          category: Database["public"]["Enums"]["staff_category"]
          gender: Database["public"]["Enums"]["gender"] | null
          date_of_birth: string | null
          phone: string
          alternate_phone: string | null
          email: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relation: string | null
          address_line1: string | null
          address_line2: string | null
          area: string | null
          city: string | null
          state: string | null
          pincode: string | null
          native_address: string | null
          qualification: string | null
          specialization: string | null
          experience_years: number | null
          languages: string[] | null
          nursing_council_reg_no: string | null
          joining_date: string
          exit_date: string | null
          exit_reason: string | null
          default_daily_wage: number
          default_ot_hourly_rate: number
          photo_path: string | null
          is_active: boolean
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_code?: string
          full_name: string
          category: Database["public"]["Enums"]["staff_category"]
          gender?: Database["public"]["Enums"]["gender"] | null
          date_of_birth?: string | null
          phone: string
          alternate_phone?: string | null
          email?: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relation?: string | null
          address_line1?: string | null
          address_line2?: string | null
          area?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          native_address?: string | null
          qualification?: string | null
          specialization?: string | null
          experience_years?: number | null
          languages?: string[] | null
          nursing_council_reg_no?: string | null
          joining_date?: string
          exit_date?: string | null
          exit_reason?: string | null
          default_daily_wage: number
          default_ot_hourly_rate?: number
          photo_path?: string | null
          is_active?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_code?: string
          full_name?: string
          category?: Database["public"]["Enums"]["staff_category"]
          gender?: Database["public"]["Enums"]["gender"] | null
          date_of_birth?: string | null
          phone?: string
          alternate_phone?: string | null
          email?: string | null
          emergency_contact_name?: string
          emergency_contact_phone?: string
          emergency_contact_relation?: string | null
          address_line1?: string | null
          address_line2?: string | null
          area?: string | null
          city?: string | null
          state?: string | null
          pincode?: string | null
          native_address?: string | null
          qualification?: string | null
          specialization?: string | null
          experience_years?: number | null
          languages?: string[] | null
          nursing_council_reg_no?: string | null
          joining_date?: string
          exit_date?: string | null
          exit_reason?: string | null
          default_daily_wage?: number
          default_ot_hourly_rate?: number
          photo_path?: string | null
          is_active?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_advances: {
        Row: {
          id: string
          staff_id: string
          advance_type: Database["public"]["Enums"]["advance_type"]
          issued_on: string
          amount: number
          reason: string | null
          recovery_per_cycle: number
          recovered_amount: number
          balance_amount: number | null
          status: Database["public"]["Enums"]["advance_status"]
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          payment_reference: string | null
          approved_by: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          advance_type?: Database["public"]["Enums"]["advance_type"]
          issued_on?: string
          amount: number
          reason?: string | null
          recovery_per_cycle?: number
          recovered_amount?: number
          status?: Database["public"]["Enums"]["advance_status"]
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          payment_reference?: string | null
          approved_by?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          advance_type?: Database["public"]["Enums"]["advance_type"]
          issued_on?: string
          amount?: number
          reason?: string | null
          recovery_per_cycle?: number
          recovered_amount?: number
          status?: Database["public"]["Enums"]["advance_status"]
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          payment_reference?: string | null
          approved_by?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_advances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_advances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_bank_accounts: {
        Row: {
          id: string
          staff_id: string
          account_holder_name: string
          account_number: string
          ifsc_code: string
          bank_name: string
          branch_name: string | null
          account_type: string | null
          upi_id: string | null
          is_primary: boolean
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          account_holder_name: string
          account_number: string
          ifsc_code: string
          bank_name: string
          branch_name?: string | null
          account_type?: string | null
          upi_id?: string | null
          is_primary?: boolean
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          account_holder_name?: string
          account_number?: string
          ifsc_code?: string
          bank_name?: string
          branch_name?: string | null
          account_type?: string | null
          upi_id?: string | null
          is_primary?: boolean
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_bank_accounts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          id: string
          staff_id: string
          doc_type: Database["public"]["Enums"]["document_type"]
          file_name: string | null
          storage_path: string
          status: Database["public"]["Enums"]["kyc_status"]
          issued_on: string | null
          expires_on: string | null
          verified_by: string | null
          verified_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          doc_type: Database["public"]["Enums"]["document_type"]
          file_name?: string | null
          storage_path: string
          status?: Database["public"]["Enums"]["kyc_status"]
          issued_on?: string | null
          expires_on?: string | null
          verified_by?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string | null
          storage_path?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          issued_on?: string | null
          expires_on?: string | null
          verified_by?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_kyc: {
        Row: {
          staff_id: string
          aadhaar_number: string | null
          pan_number: string | null
          uan_number: string | null
          esic_number: string | null
          aadhaar_doc_path: string | null
          pan_doc_path: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          police_verified: boolean
          police_verified_on: string | null
          verified_by: string | null
          verified_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          staff_id: string
          aadhaar_number?: string | null
          pan_number?: string | null
          uan_number?: string | null
          esic_number?: string | null
          aadhaar_doc_path?: string | null
          pan_doc_path?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          police_verified?: boolean
          police_verified_on?: string | null
          verified_by?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          staff_id?: string
          aadhaar_number?: string | null
          pan_number?: string | null
          uan_number?: string | null
          esic_number?: string | null
          aadhaar_doc_path?: string | null
          pan_doc_path?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          police_verified?: boolean
          police_verified_on?: string | null
          verified_by?: string | null
          verified_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_kyc_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_kyc_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_agency_monthly_pnl: {
        Row: {
          period_month: string | null
          period_label: string | null
          active_patients: number | null
          revenue: number | null
          attendant_wage_cost: number | null
          overtime_cost: number | null
          direct_costs: number | null
          gross_contribution: number | null
          overhead_costs: number | null
          net_contribution: number | null
          net_margin_pct: number | null
        }
        Relationships: []
      }
      v_attendance_detail: {
        Row: {
          id: string | null
          duty_date: string | null
          period_month: string | null
          duty_allocation_id: string | null
          patient_id: string | null
          patient_code: string | null
          patient_name: string | null
          patient_area: string | null
          staff_id: string | null
          staff_code: string | null
          staff_name: string | null
          staff_category: Database["public"]["Enums"]["staff_category"] | null
          shift_slot: Database["public"]["Enums"]["shift_slot"] | null
          duty_type: Database["public"]["Enums"]["duty_type"] | null
          status: Database["public"]["Enums"]["attendance_status"] | null
          is_replacement: boolean | null
          is_billable: boolean | null
          check_in_at: string | null
          check_out_at: string | null
          hours_on_duty: number | null
          overtime_hours: number | null
          patient_units: number | null
          patient_rate_applied: number | null
          billed_amount: number | null
          staff_units: number | null
          staff_wage_applied: number | null
          wage_amount: number | null
          overtime_amount: number | null
          total_staff_cost: number | null
          day_contribution: number | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_in_distance_m: number | null
          check_out_distance_m: number | null
          check_in_on_site: boolean | null
          is_verified: boolean | null
          notes: string | null
        }
        Relationships: []
      }
      v_daily_roster: {
        Row: {
          duty_date: string | null
          duty_allocation_id: string | null
          patient_id: string | null
          patient_name: string | null
          address_line1: string | null
          area: string | null
          primary_contact_phone: string | null
          staff_id: string | null
          staff_name: string | null
          staff_phone: string | null
          duty_type: Database["public"]["Enums"]["duty_type"] | null
          shift_slot: Database["public"]["Enums"]["shift_slot"] | null
          patient_daily_rate: number | null
          staff_daily_wage: number | null
          attendance_id: string | null
          attendance_status: Database["public"]["Enums"]["attendance_status"] | null
          check_in_at: string | null
          check_out_at: string | null
          is_unmarked: boolean | null
        }
        Relationships: []
      }
      v_duty_allocation_summary: {
        Row: {
          id: string | null
          patient_id: string | null
          patient_name: string | null
          staff_id: string | null
          staff_name: string | null
          staff_category: Database["public"]["Enums"]["staff_category"] | null
          duty_type: Database["public"]["Enums"]["duty_type"] | null
          shift_slot: Database["public"]["Enums"]["shift_slot"] | null
          status: Database["public"]["Enums"]["allocation_status"] | null
          start_date: string | null
          end_date: string | null
          patient_daily_rate: number | null
          staff_daily_wage: number | null
          daily_margin: number | null
          daily_margin_pct: number | null
          billable_units: number | null
          payable_units: number | null
          revenue_to_date: number | null
          cost_to_date: number | null
          contribution_to_date: number | null
          last_duty_date: string | null
        }
        Relationships: []
      }
      v_patient_account_summary: {
        Row: {
          patient_id: string | null
          total_billed: number | null
          advance_received: number | null
          payments_received: number | null
          security_deposit_held: number | null
          refunds_paid: number | null
          outstanding_balance: number | null
          last_duty_date: string | null
          last_payment_date: string | null
        }
        Relationships: []
      }
      v_patient_master: {
        Row: {
          id: string | null
          patient_code: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          date_of_birth: string | null
          age_years: number | null
          address_line1: string | null
          address_line2: string | null
          landmark: string | null
          area: string | null
          city: string | null
          state: string | null
          pincode: string | null
          latitude: number | null
          longitude: number | null
          geofence_radius_m: number | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_relation: string | null
          family_contact_name: string | null
          family_contact_phone: string | null
          family_contact_relation: string | null
          referring_doctor_id: string | null
          treating_doctor_id: string | null
          doctor_notes: string | null
          diagnosis: string | null
          care_requirements: string | null
          mobility_status: string | null
          allergies: string | null
          current_medications: string | null
          attendant_gender_pref: Database["public"]["Enums"]["gender"] | null
          language_preference: string[] | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          default_daily_rate: number | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          security_deposit: number | null
          gst_applicable: boolean | null
          customer_gstin: string | null
          start_date: string | null
          end_date: string | null
          status: Database["public"]["Enums"]["patient_status"] | null
          discharge_reason: string | null
          referral_source: string | null
          notes: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          age: number | null
          referring_doctor_name: string | null
          referring_doctor_phone: string | null
          treating_doctor_name: string | null
          total_billed: number | null
          advance_received: number | null
          payments_received: number | null
          security_deposit_held: number | null
          outstanding_balance: number | null
          last_duty_date: string | null
          last_payment_date: string | null
          active_allocations: number | null
          current_attendants: string | null
        }
        Relationships: []
      }
      v_patient_monthly_billing: {
        Row: {
          patient_id: string | null
          patient_code: string | null
          patient_name: string | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          period_month: string | null
          period_label: string | null
          billable_units: number | null
          duties_billed: number | null
          duties_missed: number | null
          billed_amount: number | null
          advances_received: number | null
          payments_received: number | null
          deposits_received: number | null
          refunds_paid: number | null
          collections_applied: number | null
          opening_balance: number | null
          closing_balance: number | null
        }
        Relationships: []
      }
      v_patient_profitability_monthly: {
        Row: {
          patient_id: string | null
          patient_code: string | null
          patient_name: string | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          period_month: string | null
          period_label: string | null
          billable_units: number | null
          revenue: number | null
          attendant_wage_cost: number | null
          overtime_cost: number | null
          other_direct_costs: number | null
          gross_contribution: number | null
          margin_pct: number | null
        }
        Relationships: []
      }
      v_staff_advance_balances: {
        Row: {
          advance_id: string | null
          staff_id: string | null
          staff_code: string | null
          staff_name: string | null
          advance_type: Database["public"]["Enums"]["advance_type"] | null
          issued_on: string | null
          amount: number | null
          recovered_amount: number | null
          balance_amount: number | null
          recovery_per_cycle: number | null
          status: Database["public"]["Enums"]["advance_status"] | null
          reason: string | null
          next_cycle_recovery: number | null
          last_recovery_date: string | null
        }
        Relationships: []
      }
      v_staff_monthly_salary: {
        Row: {
          staff_id: string | null
          staff_code: string | null
          staff_name: string | null
          category: Database["public"]["Enums"]["staff_category"] | null
          period_month: string | null
          period_label: string | null
          days_present: number | null
          half_days: number | null
          days_absent: number | null
          paid_leave_days: number | null
          unpaid_leave_days: number | null
          week_offs: number | null
          replacement_duties: number | null
          patients_served: number | null
          payable_units: number | null
          overtime_hours: number | null
          gross_wage: number | null
          overtime_amount: number | null
          additions: number | null
          other_deductions: number | null
          advance_recovered: number | null
          net_payable: number | null
        }
        Relationships: []
      }
      v_staff_payslips: {
        Row: {
          payroll_item_id: string | null
          payroll_run_id: string | null
          period_month: string | null
          period_label: string | null
          run_status: Database["public"]["Enums"]["payroll_status"] | null
          staff_id: string | null
          staff_code: string | null
          staff_name: string | null
          category: Database["public"]["Enums"]["staff_category"] | null
          days_present: number | null
          half_days: number | null
          days_absent: number | null
          paid_leave_days: number | null
          payable_units: number | null
          overtime_hours: number | null
          gross_wage: number | null
          overtime_amount: number | null
          additions: number | null
          other_deductions: number | null
          advance_recovery: number | null
          net_payable: number | null
          payment_status: Database["public"]["Enums"]["payslip_payment_status"] | null
          paid_amount: number | null
          paid_at: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          payment_reference: string | null
          account_number: string | null
          ifsc_code: string | null
          bank_name: string | null
          account_holder_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_create_payroll_run: {
        Args: { p_period: string; p_notes?: string | null }
        Returns: string
      }
      fn_approve_payroll_run: {
        Args: { p_run_id: string }
        Returns: Database["public"]["Tables"]["payroll_runs"]["Row"]
      }
      fn_reopen_payroll_run: {
        Args: { p_run_id: string }
        Returns: Database["public"]["Tables"]["payroll_runs"]["Row"]
      }
      fn_mark_payslip_paid: {
        Args: { p_item_id: string; p_amount?: number | null; p_mode?: Database["public"]["Enums"]["payment_mode"]; p_reference?: string | null }
        Returns: Database["public"]["Tables"]["payroll_items"]["Row"]
      }
      fn_generate_patient_invoice: {
        Args: { p_patient_id: string; p_period: string; p_issue?: boolean }
        Returns: string
      }
    }
    Enums: {
      adjustment_kind: "addition" | "deduction"
      advance_status: "open" | "closed" | "written_off"
      advance_type: "advance" | "loan" | "festival_advance"
      allocation_status: "ongoing" | "completed" | "cancelled" | "on_hold"
      attendance_status: "present" | "half_day" | "absent" | "replaced" | "week_off" | "paid_leave" | "unpaid_leave"
      billing_cycle: "monthly" | "fortnightly" | "weekly" | "on_completion"
      check_in_source: "mobile_gps" | "manual" | "supervisor" | "biometric"
      document_type: "aadhaar" | "pan" | "photo" | "address_proof" | "police_verification" | "nursing_council_certificate" | "qualification_certificate" | "bank_proof" | "signed_contract" | "medical_fitness" | "other"
      duty_type: "shift_12h" | "shift_24h" | "visit"
      expense_category: "travel" | "consumables" | "ppe" | "uniform" | "recruitment" | "training" | "office_rent" | "salaries_admin" | "marketing" | "licence_compliance" | "staff_welfare" | "replacement_cost" | "other"
      gender: "male" | "female" | "other" | "undisclosed"
      invoice_status: "draft" | "issued" | "partially_paid" | "paid" | "cancelled" | "written_off"
      kyc_status: "pending" | "submitted" | "verified" | "rejected" | "expired"
      leave_type: "paid" | "unpaid" | "sick" | "emergency" | "festival"
      patient_status: "enquiry" | "active" | "on_hold" | "discharged" | "cancelled" | "deceased"
      payment_direction: "advance" | "against_invoice" | "refund" | "security_deposit"
      payment_mode: "cash" | "upi" | "bank_transfer" | "cheque" | "card" | "other"
      payroll_status: "draft" | "approved" | "paid" | "cancelled"
      payslip_payment_status: "unpaid" | "partially_paid" | "paid" | "on_hold"
      request_status: "pending" | "approved" | "rejected" | "cancelled"
      service_type: "attendant_12h" | "attendant_24h" | "nurse_12h" | "nurse_24h" | "nurse_visit"
      shift_slot: "day" | "night" | "full_day" | "visit"
      staff_category: "nurse" | "general_attendant" | "physiotherapist" | "supervisor"
      user_role: "admin" | "coordinator" | "accountant" | "attendant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

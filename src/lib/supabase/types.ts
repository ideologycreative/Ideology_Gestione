/**
 * Hand-written to match supabase/migrations/20260911120000_initial_schema.sql.
 * Once a real Supabase project is linked, replace this file with the
 * generated one for full accuracy:
 *
 *   npx supabase gen types typescript --linked > src/lib/supabase/types.ts
 *
 * Shape (Tables/Views/Functions/Enums/CompositeTypes, `Relationships: []` on
 * every table) matches what @supabase/postgrest-js's GenericSchema requires
 * — omitting any of these makes the client's query builder fall back to
 * `never` for every row type instead of erroring, which is a much more
 * confusing failure mode.
 */

export type ApprStato = 'bozza' | 'approvare' | 'revisione' | 'approvato' | 'pubblicato';
export type ContentKind = 'feed' | 'story';
export type ContentType = 'photo' | 'carousel' | 'reel';
export type PublishState = 'pending' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type UgcStato = 'raccolto' | 'selezionato' | 'adattato' | 'approvato' | 'autonoma';
export type ProfileKind = 'studio' | 'client';
export type JobState = 'pending' | 'claimed' | 'done' | 'failed';
export type ClientTipo = 'retainer' | 'oneshot';
export type Platform = 'Instagram' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube' | 'Pinterest' | 'Threads';

export interface Slide {
  url: string;
  externalUrl: string;
  videoUrl: string;
  name: string;
  copy: string;
  note: string;
}

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          slug: string;
          color: string;
          tipo: ClientTipo;
          status: string;
          pkg: string | null;
          pkg_hours: number | null;
          revenue: number | null;
          budget: number | null;
          progetto_nome: string | null;
          progetto_deadline: string | null;
          theme: 'dark' | 'light';
          timezone: string;
          referente_nome: string;
          referente_email: string;
          referente_tel: string;
          note: string;
          logo_url: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['clients']['Row']> & { name: string; slug: string };
        Update: Partial<Database['public']['Tables']['clients']['Row']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          kind: ProfileKind;
          client_id: string | null;
          name: string;
          ui_prefs: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { user_id: string; kind: ProfileKind };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          client_id: string;
          platform: Platform;
          handle: string;
          name: string;
          meta_connection_id: string | null;
          meta_page_id: string | null;
          meta_ig_user_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['accounts']['Row']> & { client_id: string; platform: Platform };
        Update: Partial<Database['public']['Tables']['accounts']['Row']>;
        Relationships: [];
      };
      pillars: {
        Row: { id: string; client_id: string; name: string; color: string };
        Insert: Partial<Database['public']['Tables']['pillars']['Row']> & { client_id: string; name: string };
        Update: Partial<Database['public']['Tables']['pillars']['Row']>;
        Relationships: [];
      };
      formats: {
        Row: { id: string; client_id: string; name: string; ratio: string };
        Insert: Partial<Database['public']['Tables']['formats']['Row']> & { client_id: string; name: string };
        Update: Partial<Database['public']['Tables']['formats']['Row']>;
        Relationships: [];
      };
      content_items: {
        Row: {
          id: string;
          client_id: string;
          account_id: string;
          kind: ContentKind;
          group_id: string;
          type: ContentType;
          url: string;
          external_url: string;
          video_url: string;
          slides: Slide[];
          date: string;
          publish_time: string;
          copy: string;
          note: string;
          pillar_id: string | null;
          format_id: string | null;
          appr_stato: ApprStato;
          appr_revisions: number;
          sponsored: boolean;
          client_note: string;
          appr_note: string;
          client_name: string;
          appr_by: string;
          appr_date: string | null;
          publish_state: PublishState;
          permalink: string | null;
          publish_error: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['content_items']['Row']> & {
          client_id: string;
          account_id: string;
          kind: ContentKind;
          date: string;
        };
        Update: Partial<Database['public']['Tables']['content_items']['Row']>;
        Relationships: [];
      };
      ugc_slots: {
        Row: {
          id: string;
          client_id: string;
          date: string;
          brief: string;
          ugc_stato: UgcStato;
          creator: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['ugc_slots']['Row']> & { client_id: string; date: string };
        Update: Partial<Database['public']['Tables']['ugc_slots']['Row']>;
        Relationships: [];
      };
      meta_connections: {
        Row: {
          id: string;
          provider: string;
          meta_account_id: string;
          account_name: string;
          business_name: string;
          access_token_encrypted: string | null; // never selectable by anon/authenticated
          connected_at: string;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['meta_connections']['Row']> & { meta_account_id: string };
        Update: Partial<Database['public']['Tables']['meta_connections']['Row']>;
        Relationships: [];
      };
      meta_pages: {
        Row: {
          id: string;
          connection_id: string;
          page_id: string;
          name: string;
          category: string;
          ig_user_id: string | null;
          ig_username: string | null;
          ig_account_type: 'BUSINESS' | 'CREATOR' | 'PERSONAL' | null;
        };
        Insert: Partial<Database['public']['Tables']['meta_pages']['Row']> & { connection_id: string; page_id: string };
        Update: Partial<Database['public']['Tables']['meta_pages']['Row']>;
        Relationships: [];
      };
      scheduled_jobs: {
        Row: {
          id: string;
          content_item_id: string;
          run_at: string;
          state: JobState;
          attempts: number;
          idempotency_key: string;
          claimed_at: string | null;
          completed_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['scheduled_jobs']['Row']> & {
          content_item_id: string;
          run_at: string;
          idempotency_key: string;
        };
        Update: Partial<Database['public']['Tables']['scheduled_jobs']['Row']>;
        Relationships: [];
      };
      settings: {
        Row: { key: string; value: Record<string, unknown>; updated_at: string };
        Insert: { key: string; value: Record<string, unknown> };
        Update: Partial<Database['public']['Tables']['settings']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      approve_content_item: {
        Args: { p_item_id: string };
        Returns: void;
      };
      request_revision: {
        Args: { p_item_id: string; p_note: string };
        Returns: void;
      };
    };
    Enums: {
      appr_stato: ApprStato;
      content_kind: ContentKind;
      content_type: ContentType;
      publish_state: PublishState;
      ugc_stato: UgcStato;
      profile_kind: ProfileKind;
      job_state: JobState;
      client_tipo: ClientTipo;
    };
    CompositeTypes: Record<string, never>;
  };
}

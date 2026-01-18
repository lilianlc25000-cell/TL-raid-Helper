export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          guild_id: string | null;
          ingame_name: string;
          main_weapon: string | null;
          off_weapon: string | null;
          cohesion_points: number;
          loot_received_count: number;
          gear_score: number | null;
          role_rank: string | null;
          role: string | null;
          archetype: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          guild_id?: string | null;
          ingame_name: string;
          main_weapon?: string | null;
          off_weapon?: string | null;
          cohesion_points?: number;
          loot_received_count?: number;
          gear_score?: number | null;
          role_rank?: string | null;
          role?: string | null;
          archetype?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          guild_id?: string | null;
          ingame_name?: string;
          main_weapon?: string | null;
          off_weapon?: string | null;
          cohesion_points?: number;
          loot_received_count?: number;
          gear_score?: number | null;
          role_rank?: string | null;
          role?: string | null;
          archetype?: string | null;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          event_type: string;
          difficulty: string | null;
          start_time: string;
          description: string | null;
          cohesion_reward: number;
          status: string;
          is_points_distributed: boolean;
          are_groups_published: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          event_type: string;
          difficulty?: string | null;
          start_time: string;
          description?: string | null;
          cohesion_reward?: number;
          status?: string;
          is_points_distributed?: boolean;
          are_groups_published?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          event_type?: string;
          difficulty?: string | null;
          start_time?: string;
          description?: string | null;
          cohesion_reward?: number;
          status?: string;
          is_points_distributed?: boolean;
          are_groups_published?: boolean;
        };
      };
      signups: {
        Row: {
          event_id: string;
          user_id: string;
          status: string;
          weapon_config: Json;
        };
        Insert: {
          event_id: string;
          user_id: string;
          status: string;
          weapon_config: Json;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          status?: string;
          weapon_config?: Json;
        };
      };
      event_signups: {
        Row: {
          user_id: string;
          event_id: string;
          status: string;
          created_at: string;
          group_index: number | null;
        };
        Insert: {
          user_id: string;
          event_id: string;
          status: string;
          created_at?: string;
          group_index?: number | null;
        };
        Update: {
          user_id?: string;
          event_id?: string;
          status?: string;
          created_at?: string;
          group_index?: number | null;
        };
      };
      wishlists: {
        Row: {
          user_id: string;
          item_name: string;
          priority: number;
        };
        Insert: {
          user_id: string;
          item_name: string;
          priority: number;
        };
        Update: {
          user_id?: string;
          item_name?: string;
          priority?: number;
        };
      };
      loot_rolls: {
        Row: {
          id: string;
          user_id: string;
          item_name: string;
          roll_value: number;
          created_at: string;
          loot_session_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_name: string;
          roll_value: number;
          created_at?: string;
          loot_session_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_name?: string;
          roll_value?: number;
          created_at?: string;
          loot_session_id?: string | null;
        };
      };
      gear_wishlist: {
        Row: {
          id: string;
          user_id: string;
          slot_name:
            | "main_hand"
            | "off_hand"
            | "head"
            | "chest"
            | "gloves"
            | "legs"
            | "feet"
            | "cloak"
            | "necklace"
            | "bracelet"
            | "ring1"
            | "ring2"
            | "belt";
          item_name: string;
          item_priority: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slot_name:
            | "main_hand"
            | "off_hand"
            | "head"
            | "chest"
            | "gloves"
            | "legs"
            | "feet"
            | "cloak"
            | "necklace"
            | "bracelet"
            | "ring1"
            | "ring2"
            | "belt";
          item_name: string;
          item_priority: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slot_name?:
            | "main_hand"
            | "off_hand"
            | "head"
            | "chest"
            | "gloves"
            | "legs"
            | "feet"
            | "cloak"
            | "necklace"
            | "bracelet"
            | "ring1"
            | "ring2"
            | "belt";
          item_name?: string;
          item_priority?: number;
          updated_at?: string;
        };
      };
      active_loot_sessions: {
        Row: {
          id: string;
          item_name: string;
          is_active: boolean;
          category: string;
          custom_name: string | null;
          custom_traits: Json | null;
          rarity: string;
          image_url: string | null;
        };
        Insert: {
          id?: string;
          item_name: string;
          is_active?: boolean;
          category?: string;
          custom_name?: string | null;
          custom_traits?: Json | null;
          rarity?: string;
          image_url?: string | null;
        };
        Update: {
          id?: string;
          item_name?: string;
          is_active?: boolean;
          category?: string;
          custom_name?: string | null;
          custom_traits?: Json | null;
          rarity?: string;
          image_url?: string | null;
        };
      };
      direct_messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          body?: string;
          created_at?: string;
        };
      };
      guild_messages: {
        Row: {
          id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          message?: string;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};


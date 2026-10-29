// СГЕНЕРИРОВАНО по схеме облачной БД (Supabase: generate_typescript_types).
// После изменения миграций — пересоздать. Вспомогательные обобщённые типы опущены.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      ingredient_categories: {
        Row: { name: string; slug: string; sort: number }
        Insert: { name: string; slug: string; sort?: number }
        Update: { name?: string; slug?: string; sort?: number }
        Relationships: []
      }
      ingredient_synonyms: {
        Row: {
          id: number
          ingredient_id: number
          synonym: string
          synonym_normalized: string | null
        }
        Insert: {
          id?: never
          ingredient_id: number
          synonym: string
          synonym_normalized?: string | null
        }
        Update: {
          id?: never
          ingredient_id?: number
          synonym?: string
          synonym_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ingredient_synonyms_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
        ]
      }
      ingredients: {
        Row: {
          category_slug: string
          created_at: string
          default_unit: string | null
          density_g_per_ml: number | null
          id: number
          name: string
          name_normalized: string | null
          owner_id: string | null
          piece_weight_g: number | null
        }
        Insert: {
          category_slug?: string
          created_at?: string
          default_unit?: string | null
          density_g_per_ml?: number | null
          id?: never
          name: string
          name_normalized?: string | null
          owner_id?: string | null
          piece_weight_g?: number | null
        }
        Update: {
          category_slug?: string
          created_at?: string
          default_unit?: string | null
          density_g_per_ml?: number | null
          id?: never
          name?: string
          name_normalized?: string | null
          owner_id?: string | null
          piece_weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'ingredients_category_slug_fkey'
            columns: ['category_slug']
            isOneToOne: false
            referencedRelation: 'ingredient_categories'
            referencedColumns: ['slug']
          },
          {
            foreignKeyName: 'ingredients_default_unit_fkey'
            columns: ['default_unit']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['code']
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: number
          importance: string
          ingredient_id: number
          note: string | null
          position: number
          quantity: number | null
          quantity_text: string | null
          recipe_id: number
          unit_code: string | null
        }
        Insert: {
          id?: never
          importance?: string
          ingredient_id: number
          note?: string | null
          position: number
          quantity?: number | null
          quantity_text?: string | null
          recipe_id: number
          unit_code?: string | null
        }
        Update: {
          id?: never
          importance?: string
          ingredient_id?: number
          note?: string | null
          position?: number
          quantity?: number | null
          quantity_text?: string | null
          recipe_id?: number
          unit_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_ingredients_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_ingredients_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_ingredients_unit_code_fkey'
            columns: ['unit_code']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['code']
          },
        ]
      }
      recipe_sources: {
        Row: {
          author: string | null
          created_at: string
          id: number
          kind: string
          retrieved_on: string | null
          rights: string
          rights_note: string | null
          title: string
          url: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: never
          kind: string
          retrieved_on?: string | null
          rights?: string
          rights_note?: string | null
          title: string
          url?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: never
          kind?: string
          retrieved_on?: string | null
          rights?: string
          rights_note?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      recipe_steps: {
        Row: {
          duration_minutes: number | null
          id: number
          instruction: string
          position: number
          recipe_id: number
        }
        Insert: {
          duration_minutes?: number | null
          id?: never
          instruction: string
          position: number
          recipe_id: number
        }
        Update: {
          duration_minutes?: number | null
          id?: never
          instruction?: string
          position?: number
          recipe_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_steps_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      recipes: {
        Row: {
          cook_minutes: number | null
          cooked_verified_at: string | null
          cooked_verified_note: string | null
          cooking_methods: string[]
          created_at: string
          cuisine: string | null
          description: string | null
          difficulty: number | null
          equipment: string[]
          id: number
          image_url: string | null
          is_published: boolean
          is_sample: boolean
          meal_types: string[]
          origin: string
          owner_id: string | null
          prep_minutes: number | null
          servings: number | null
          source_checked_at: string | null
          source_checked_note: string | null
          source_id: number | null
          tags: string[]
          title: string
          updated_at: string
          video_url: string | null
          yield_grams: number | null
        }
        Insert: {
          cook_minutes?: number | null
          cooked_verified_at?: string | null
          cooked_verified_note?: string | null
          cooking_methods?: string[]
          created_at?: string
          cuisine?: string | null
          description?: string | null
          difficulty?: number | null
          equipment?: string[]
          id?: never
          image_url?: string | null
          is_published?: boolean
          is_sample?: boolean
          meal_types?: string[]
          origin: string
          owner_id?: string | null
          prep_minutes?: number | null
          servings?: number | null
          source_checked_at?: string | null
          source_checked_note?: string | null
          source_id?: number | null
          tags?: string[]
          title: string
          updated_at?: string
          video_url?: string | null
          yield_grams?: number | null
        }
        Update: {
          cook_minutes?: number | null
          cooked_verified_at?: string | null
          cooked_verified_note?: string | null
          cooking_methods?: string[]
          created_at?: string
          cuisine?: string | null
          description?: string | null
          difficulty?: number | null
          equipment?: string[]
          id?: never
          image_url?: string | null
          is_published?: boolean
          is_sample?: boolean
          meal_types?: string[]
          origin?: string
          owner_id?: string | null
          prep_minutes?: number | null
          servings?: number | null
          source_checked_at?: string | null
          source_checked_note?: string | null
          source_id?: number | null
          tags?: string[]
          title?: string
          updated_at?: string
          video_url?: string | null
          yield_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'recipes_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'recipe_sources'
            referencedColumns: ['id']
          },
        ]
      }
      units: {
        Row: {
          base_factor: number | null
          code: string
          is_approximate: boolean
          kind: string
          name: string
          sort: number
        }
        Insert: {
          base_factor?: number | null
          code: string
          is_approximate?: boolean
          kind: string
          name: string
          sort?: number
        }
        Update: {
          base_factor?: number | null
          code?: string
          is_approximate?: boolean
          kind?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      user_products: {
        Row: {
          created_at: string
          expires_on: string | null
          id: number
          ingredient_id: number
          is_excluded: boolean
          kind: string
          note: string | null
          quantity: number | null
          unit_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: never
          ingredient_id: number
          is_excluded?: boolean
          kind: string
          note?: string | null
          quantity?: number | null
          unit_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: never
          ingredient_id?: number
          is_excluded?: boolean
          kind?: string
          note?: string | null
          quantity?: number | null
          unit_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_products_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_products_unit_code_fkey'
            columns: ['unit_code']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['code']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      app_health: { Args: never; Returns: Json }
      ingredient_visible: { Args: { p_ingredient_id: number }; Returns: boolean }
      normalize_name: { Args: { value: string }; Returns: string }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

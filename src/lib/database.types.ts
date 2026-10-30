// СГЕНЕРИРОВАНО по схеме облачной БД (Supabase: generate_typescript_types).
// После изменения миграций — пересоздать. Вспомогательные обобщённые типы опущены.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      app_admins: {
        Row: { created_at: string; user_id: string }
        Insert: { created_at?: string; user_id: string }
        Update: { created_at?: string; user_id?: string }
        Relationships: []
      }
      diary_entries: {
        Row: {
          amount: number | null
          amount_unit: string
          base_amount: number | null
          base_carbs: number
          base_fat: number
          base_kcal: number
          base_protein: number
          base_servings: number | null
          carbs: number | null
          composition: Json
          created_at: string
          eaten_on: string
          eaten_time: string | null
          fat: number | null
          id: number
          ingredient_id: number | null
          kcal: number | null
          kind: string
          meal: string
          note: string | null
          nutrition_incomplete: boolean
          protein: number | null
          recipe_id: number | null
          serving_unit: string
          servings: number | null
          title: string
          updated_at: string
          user_id: string
          version_id: number | null
        }
        Insert: {
          amount?: number | null
          amount_unit?: string
          base_amount?: number | null
          base_carbs: number
          base_fat: number
          base_kcal: number
          base_protein: number
          base_servings?: number | null
          carbs?: number | null
          composition?: Json
          created_at?: string
          eaten_on: string
          eaten_time?: string | null
          fat?: number | null
          id?: never
          ingredient_id?: number | null
          kcal?: number | null
          kind: string
          meal: string
          note?: string | null
          nutrition_incomplete?: boolean
          protein?: number | null
          recipe_id?: number | null
          serving_unit?: string
          servings?: number | null
          title: string
          updated_at?: string
          user_id?: string
          version_id?: number | null
        }
        Update: {
          amount?: number | null
          amount_unit?: string
          base_amount?: number | null
          base_carbs?: number
          base_fat?: number
          base_kcal?: number
          base_protein?: number
          base_servings?: number | null
          carbs?: number | null
          composition?: Json
          created_at?: string
          eaten_on?: string
          eaten_time?: string | null
          fat?: number | null
          id?: never
          ingredient_id?: number | null
          kcal?: number | null
          kind?: string
          meal?: string
          note?: string | null
          nutrition_incomplete?: boolean
          protein?: number | null
          recipe_id?: number | null
          serving_unit?: string
          servings?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          version_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'diary_entries_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diary_entries_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'diary_entries_version_id_fkey'
            columns: ['version_id']
            isOneToOne: false
            referencedRelation: 'recipe_versions'
            referencedColumns: ['id']
          },
        ]
      }
      favorite_recipes: {
        Row: { created_at: string; recipe_id: number; user_id: string }
        Insert: { created_at?: string; recipe_id: number; user_id?: string }
        Update: { created_at?: string; recipe_id?: number; user_id?: string }
        Relationships: [
          {
            foreignKeyName: 'favorite_recipes_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      ingredient_categories: {
        Row: { name: string; slug: string; sort: number }
        Insert: { name: string; slug: string; sort?: number }
        Update: { name?: string; slug?: string; sort?: number }
        Relationships: []
      }
      ingredient_nutrition: {
        Row: {
          state: string
          carbs_g: number
          fat_g: number
          ingredient_id: number
          is_approximate: boolean
          kcal: number
          note: string | null
          protein_g: number
          source_code: string
          source_food_id: string
          source_food_name: string
        }
        Insert: {
          state?: string
          carbs_g: number
          fat_g: number
          ingredient_id: number
          is_approximate?: boolean
          kcal: number
          note?: string | null
          protein_g: number
          source_code: string
          source_food_id: string
          source_food_name: string
        }
        Update: {
          state?: string
          carbs_g?: number
          fat_g?: number
          ingredient_id?: number
          is_approximate?: boolean
          kcal?: number
          note?: string | null
          protein_g?: number
          source_code?: string
          source_food_id?: string
          source_food_name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ingredient_nutrition_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ingredient_nutrition_source_code_fkey'
            columns: ['source_code']
            isOneToOne: false
            referencedRelation: 'nutrition_sources'
            referencedColumns: ['code']
          },
        ]
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
      ingredient_unit_weights: {
        Row: {
          state: string
          grams: number
          ingredient_id: number
          note: string | null
          source_code: string
          source_food_id: string
          source_portion: string
          unit_code: string
        }
        Insert: {
          state?: string
          grams: number
          ingredient_id: number
          note?: string | null
          source_code: string
          source_food_id: string
          source_portion: string
          unit_code: string
        }
        Update: {
          state?: string
          grams?: number
          ingredient_id?: number
          note?: string | null
          source_code?: string
          source_food_id?: string
          source_portion?: string
          unit_code?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ingredient_unit_weights_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ingredient_unit_weights_source_code_fkey'
            columns: ['source_code']
            isOneToOne: false
            referencedRelation: 'nutrition_sources'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'ingredient_unit_weights_unit_code_fkey'
            columns: ['unit_code']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['code']
          },
        ]
      }
      ingredients: {
        Row: {
          category_slug: string
          created_at: string
          default_unit: string | null
          id: number
          name: string
          name_normalized: string | null
          owner_id: string | null
        }
        Insert: {
          category_slug?: string
          created_at?: string
          default_unit?: string | null
          id?: never
          name: string
          name_normalized?: string | null
          owner_id?: string | null
        }
        Update: {
          category_slug?: string
          created_at?: string
          default_unit?: string | null
          id?: never
          name?: string
          name_normalized?: string | null
          owner_id?: string | null
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
      nutrition_sources: {
        Row: {
          citation: string
          code: string
          dataset_version: string | null
          license: string
          license_url: string | null
          publisher: string
          retrieved_on: string
          title: string
          url: string
        }
        Insert: {
          citation: string
          code: string
          dataset_version?: string | null
          license: string
          license_url?: string | null
          publisher: string
          retrieved_on: string
          title: string
          url: string
        }
        Update: {
          citation?: string
          code?: string
          dataset_version?: string | null
          license?: string
          license_url?: string | null
          publisher?: string
          retrieved_on?: string
          title?: string
          url?: string
        }
        Relationships: []
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
      recipe_version_ingredients: {
        Row: {
          id: number
          importance: string
          ingredient_id: number
          note: string | null
          original_position: number | null
          position: number
          quantity: number | null
          quantity_text: string | null
          unit_code: string | null
          version_id: number
        }
        Insert: {
          id?: never
          importance?: string
          ingredient_id: number
          note?: string | null
          original_position?: number | null
          position: number
          quantity?: number | null
          quantity_text?: string | null
          unit_code?: string | null
          version_id: number
        }
        Update: {
          id?: never
          importance?: string
          ingredient_id?: number
          note?: string | null
          original_position?: number | null
          position?: number
          quantity?: number | null
          quantity_text?: string | null
          unit_code?: string | null
          version_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_version_ingredients_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_version_ingredients_unit_code_fkey'
            columns: ['unit_code']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'recipe_version_ingredients_version_id_fkey'
            columns: ['version_id']
            isOneToOne: false
            referencedRelation: 'recipe_versions'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_versions: {
        Row: {
          created_at: string
          id: number
          name: string
          note: string | null
          recipe_id: number
          servings: number | null
          updated_at: string
          user_id: string
          yield_grams: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          note?: string | null
          recipe_id: number
          servings?: number | null
          updated_at?: string
          user_id?: string
          yield_grams?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          note?: string | null
          recipe_id?: number
          servings?: number | null
          updated_at?: string
          user_id?: string
          yield_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_versions_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_yield_measurements: {
        Row: { measured_at: string; recipe_id: number; user_id: string; yield_grams: number }
        Insert: { measured_at?: string; recipe_id: number; user_id?: string; yield_grams: number }
        Update: { measured_at?: string; recipe_id?: number; user_id?: string; yield_grams?: number }
        Relationships: [
          {
            foreignKeyName: 'recipe_yield_measurements_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_sources: {
        Row: {
          author: string | null
          authors_url: string | null
          created_at: string
          id: number
          kind: string
          license: string | null
          license_url: string | null
          retrieved_on: string | null
          rights: string
          rights_note: string | null
          source_revision: string | null
          title: string
          url: string | null
        }
        Insert: {
          author?: string | null
          authors_url?: string | null
          created_at?: string
          id?: never
          kind: string
          license?: string | null
          license_url?: string | null
          retrieved_on?: string | null
          rights?: string
          rights_note?: string | null
          source_revision?: string | null
          title: string
          url?: string | null
        }
        Update: {
          author?: string | null
          authors_url?: string | null
          created_at?: string
          id?: never
          kind?: string
          license?: string | null
          license_url?: string | null
          retrieved_on?: string | null
          rights?: string
          rights_note?: string | null
          source_revision?: string | null
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
          adaptation_note: string | null
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
          image_credit: string | null
          image_source_url: string | null
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
          adaptation_note?: string | null
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
          image_credit?: string | null
          image_source_url?: string | null
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
          adaptation_note?: string | null
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
          image_credit?: string | null
          image_source_url?: string | null
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
      user_ingredient_nutrition: {
        Row: {
          basis: string
          brand: string | null
          carbs_g: number
          fat_g: number
          ingredient_id: number
          kcal: number
          note: string | null
          package_grams: number | null
          piece_grams: number | null
          protein_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          basis: string
          brand?: string | null
          carbs_g: number
          fat_g: number
          ingredient_id: number
          kcal: number
          note?: string | null
          package_grams?: number | null
          piece_grams?: number | null
          protein_g: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          basis?: string
          brand?: string | null
          carbs_g?: number
          fat_g?: number
          ingredient_id?: number
          kcal?: number
          note?: string | null
          package_grams?: number | null
          piece_grams?: number | null
          protein_g?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_ingredient_nutrition_ingredient_id_fkey'
            columns: ['ingredient_id']
            isOneToOne: false
            referencedRelation: 'ingredients'
            referencedColumns: ['id']
          },
        ]
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
      is_admin: { Args: never; Returns: boolean }
      normalize_name: { Args: { value: string }; Returns: string }
      recipe_version_owned: { Args: { p_version_id: number }; Returns: boolean }
      save_recipe_version: {
        // Уточнено вручную: генератор помечает все аргументы функций как обязательные,
        // а p_id (новая версия), p_note, p_servings и p_yield_grams бывают null.
        Args: {
          p_id: number | null
          p_lines: Json
          p_name: string
          p_note: string | null
          p_recipe_id: number
          p_servings: number | null
          p_yield_grams: number | null
        }
        Returns: number
      }
      set_recipe_image: {
        // Уточнено вручную: null в p_url убирает фото, p_credit и p_source_url тогда не нужны.
        Args: {
          p_credit: string | null
          p_recipe_id: number
          p_source_url?: string | null
          p_url: string | null
        }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

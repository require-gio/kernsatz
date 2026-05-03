// Model name constants - single source of truth for model identifiers
// Keep in sync with frontend/src-tauri/src/summary/summary_engine/models.rs

/** Ministral 3B model name (primary/recommended model) */
export const MODEL_NAME_MINISTRAL_3B = 'ministral:3b';

/** Gemma 3 1B model name (fast/lightweight model) */
export const MODEL_NAME_GEMMA3_1B = 'gemma3:1b';

/** Gemma 3 4B model name */
export const MODEL_NAME_GEMMA3_4B = 'gemma3:4b';

/** Size string for Ministral 3B */
export const MODEL_SIZE_MINISTRAL_3B = '~2.2 GB';

/** Size string for Gemma 3 1B */
export const MODEL_SIZE_GEMMA3_1B = '~806 MB';

/** Size string for Gemma 3 4B */
export const MODEL_SIZE_GEMMA3_4B = '~2.5 GB';

/** Default/fallback model name */
export const DEFAULT_MODEL_NAME = MODEL_NAME_MINISTRAL_3B;

export const DEFUALT_MODEL_SIZE = MODEL_SIZE_MINISTRAL_3B;

/** All known built-in summary model names */
export const BUILTIN_SUMMARY_MODELS = [MODEL_NAME_MINISTRAL_3B, MODEL_NAME_GEMMA3_1B, MODEL_NAME_GEMMA3_4B] as const;

/** Get the display size for a model name */
export function getModelSizeLabel(modelName: string): string {
  switch (modelName) {
    case MODEL_NAME_MINISTRAL_3B:
      return MODEL_SIZE_MINISTRAL_3B;
    case MODEL_NAME_GEMMA3_1B:
      return MODEL_SIZE_GEMMA3_1B;
    case MODEL_NAME_GEMMA3_4B:
      return MODEL_SIZE_GEMMA3_4B;
    default:
      return MODEL_SIZE_GEMMA3_1B;
  }
}

/** Check if a model name is a known built-in summary model */
export function isBuiltinSummaryModel(modelName: string): boolean {
  return (BUILTIN_SUMMARY_MODELS as readonly string[]).includes(modelName);
}

/** Size in MB for Ministral 3B */
export const MODEL_SIZE_MB_MINISTRAL_3B = 2200;

/** Size in MB for Gemma 3 1B */
export const MODEL_SIZE_MB_GEMMA3_1B = 806;

/** Size in MB for Gemma 3 4B */
export const MODEL_SIZE_MB_GEMMA3_4B = 2500;

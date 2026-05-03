// Model definitions and prompt templates for built-in AI summary generation
// Designed for easy extension - just add new entries to get_available_models()

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ============================================================================
// Model Name Constants
// ============================================================================

/// Model name for Ministral 3B (primary/recommended model)
pub const MODEL_NAME_MINISTRAL_3B: &str = "ministral:3b";

/// Model name for Gemma 3 1B (fast/lightweight model)
pub const MODEL_NAME_GEMMA3_1B: &str = "gemma3:1b";

/// Model name for Gemma 3 4B
pub const MODEL_NAME_GEMMA3_4B: &str = "gemma3:4b";

/// Size of the Ministral 3B model in MB
pub const MODEL_SIZE_MB_MINISTRAL_3B: u64 = 2150;

/// Size of the Gemma 3 1B model in MB
pub const MODEL_SIZE_MB_GEMMA3_1B: u64 = 806;

/// Size of the Gemma 3 4B model in MB
pub const MODEL_SIZE_MB_GEMMA3_4B: u64 = 2500;

pub const DEFAULT_MODEL_NAME: &str = MODEL_NAME_MINISTRAL_3B; // Default to the more powerful model, but can be overridden based on system requirements

// ============================================================================
// Model Definitions
// ============================================================================

/// Sampling parameters for text generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamplingParams {
    /// Temperature - controls randomness (0.0 = deterministic, 1.0 = balanced, 2.0 = very creative)
    pub temperature: f32,

    /// Top-K sampling - limits vocabulary to top K tokens (0 = disabled)
    pub top_k: i32,

    /// Top-P (nucleus) sampling - cumulative probability threshold (1.0 = disabled)
    pub top_p: f32,

    /// Stop tokens - generation stops when any of these appear in output
    pub stop_tokens: Vec<String>,
}

/// Definition of a built-in AI model with all metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDef {
    /// Model name in format "family:variant" (e.g., MODEL_NAME_GEMMA3_1B)
    /// This is what's stored in database as model field when provider="builtin-ai"
    pub name: String,

    /// Display name for UI (e.g., "Gemma 3 1B (Fast)")
    pub display_name: String,

    /// GGUF filename on disk (e.g., "gemma-3-1b-it-q4_0.gguf")
    pub gguf_file: String,

    /// Template name for prompt formatting (e.g., "gemma3")
    pub template: String,

    /// Download URL (HuggingFace or other source)
    pub download_url: String,

    /// File size in MB
    pub size_mb: u64,

    /// Context window size in tokens (configurable per model!)
    /// This is used for chunking in processor.rs
    pub context_size: u32,

    /// Model layer count (for GPU offloading calculation)
    pub layer_count: u32,

    /// Sampling parameters for this model
    pub sampling: SamplingParams,

    /// Short description for UI
    pub description: String,
}

/// Get all available built-in AI models
/// Add new models here - the system will automatically detect and manage them
pub fn get_available_models() -> Vec<ModelDef> {
    
    vec![
        // Ministral 3B - German-optimized tier
        ModelDef {
            name: MODEL_NAME_MINISTRAL_3B.to_string(),
            display_name: "Ministral 3B (Deutsch)".to_string(),
            gguf_file: "Ministral-3-3B-Instruct-2512-Q4_K_M.gguf".to_string(),
            template: "mistral".to_string(),
            download_url: "https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF/resolve/main/Ministral-3-3B-Instruct-2512-Q4_K_M.gguf".to_string(),
            size_mb: MODEL_SIZE_MB_MINISTRAL_3B,
            context_size: 32768,
            layer_count: 36,
            sampling: SamplingParams {
                temperature: 0.1,
                top_k: 40,
                top_p: 0.9,
                stop_tokens: vec!["</s>".to_string()],
            },
            description: "Mehrsprachiges Modell mit starker deutscher Unterstützung. ~2,2GB Download.".to_string(),
        },
        // Gemma 3 1B - Fast tier
        ModelDef {
            name: MODEL_NAME_GEMMA3_1B.to_string(),
            display_name: "Gemma 3 1B (Schnell)".to_string(),
            gguf_file: "gemma-3-1b-it-Q8_0.gguf".to_string(),
            template: "gemma3".to_string(),
            download_url: "https://meetily.towardsgeneralintelligence.com/models/gemma-3-1b-it-Q8_0.gguf".to_string(),
            size_mb: MODEL_SIZE_MB_GEMMA3_1B,
            context_size: 32768, 
            layer_count: 26,     
            sampling: SamplingParams {
                temperature: 1.0,
                top_k: 64,
                top_p: 0.95,
                stop_tokens: vec!["<end_of_turn>".to_string()],
            },
            description: "Schnellstes Modell. Läuft auf jeder Hardware mit ~1GB RAM. Gut für schnelle Zusammenfassungen, schlechter in deutscher Grammatik.".to_string(),
        },
    ]
}

/// Get a specific model by name
pub fn get_model_by_name(name: &str) -> Option<ModelDef> {
    get_available_models().into_iter().find(|m| m.name == name)
}

/// Get the default model (first in list)
pub fn get_default_model() -> ModelDef {
    get_available_models()
        .into_iter()
        .next()
        .expect("At least one model must be defined")
}

/// Resolve model name to full file path in the models directory
pub fn get_model_path(app_data_dir: &PathBuf, model_name: &str) -> Result<PathBuf> {
    let model = get_model_by_name(model_name)
        .ok_or_else(|| anyhow!("Unknown model: {}", model_name))?;

    let models_dir = get_models_directory(app_data_dir);
    let model_path = models_dir.join(&model.gguf_file);

    Ok(model_path)
}

/// Get the models directory path for built-in AI
pub fn get_models_directory(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("models").join("summary")
}

// ============================================================================
// Prompt Templates (Model-Specific Formatting)
// ============================================================================

/// Mistral Instruct chat template format (Ministral 3B and similar)
pub const MISTRAL_TEMPLATE: &str = "[INST] {system_prompt}\n\n{user_prompt} [/INST]";

/// Gemma 3 chat template format
pub const GEMMA3_TEMPLATE: &str = "\
<start_of_turn>user
{system_prompt}<end_of_turn>
<start_of_turn>user
{user_prompt}<end_of_turn>
<start_of_turn>model
";

/// Format a prompt using the specified template
///
/// # Arguments
/// * `template_name` - Template identifier (e.g., "gemma3", "chatml", "llama3")
/// * `system_prompt` - System message (instructions for the model)
/// * `user_prompt` - User message (actual task/question)
///
/// # Returns
/// Formatted prompt string ready to send to llama-helper
pub fn format_prompt(
    template_name: &str,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String> {
    let template = match template_name {
        "gemma3" => GEMMA3_TEMPLATE,
        "mistral" => MISTRAL_TEMPLATE,
        _ => return Err(anyhow!("Unknown template: {}", template_name)),
    };

    let formatted = template
        .replace("{system_prompt}", system_prompt)
        .replace("{user_prompt}", user_prompt);

    Ok(formatted)
}

// ============================================================================
// Configuration Constants
// ============================================================================

/// Default max tokens for generation (increased for better summary quality)
pub const DEFAULT_MAX_TOKENS: i32 = 4096;

/// Idle timeout for sidecar (seconds) - can be overridden via LLAMA_IDLE_TIMEOUT env var
pub const DEFAULT_IDLE_TIMEOUT_SECS: u64 = 300; // 5 minutes

/// Generation timeout (how long to wait for a response)
pub const GENERATION_TIMEOUT_SECS: u64 = 900; // 15 minutes

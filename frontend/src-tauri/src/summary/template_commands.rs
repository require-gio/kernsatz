use crate::summary::templates;
use serde::{Deserialize, Serialize};
use tauri::Runtime;
use tracing::{info, warn};

/// Template metadata for UI display
#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateInfo {
    /// Template identifier (e.g., "daily_standup", "standard_meeting")
    pub id: String,

    /// Display name for the template
    pub name: String,

    /// Brief description of the template's purpose
    pub description: String,
}

/// Detailed template structure for preview/debugging
#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateDetails {
    /// Template identifier
    pub id: String,

    /// Display name
    pub name: String,

    /// Description
    pub description: String,

    /// List of section titles in order
    pub sections: Vec<String>,
}

/// Lists all available templates
///
/// Returns templates from both built-in (embedded) and custom (user data directory) sources.
/// Templates are automatically discovered - no code changes needed to add new templates.
///
/// # Returns
/// Vector of TemplateInfo with id, name, and description for each template
#[tauri::command]
pub async fn api_list_templates<R: Runtime>(
    _app: tauri::AppHandle<R>,
) -> Result<Vec<TemplateInfo>, String> {
    info!("api_list_templates called");

    let templates = templates::list_templates();

    let template_infos: Vec<TemplateInfo> = templates
        .into_iter()
        .map(|(id, name, description)| TemplateInfo {
            id,
            name,
            description,
        })
        .collect();

    info!("Found {} available templates", template_infos.len());

    Ok(template_infos)
}

/// Gets detailed information about a specific template
///
/// # Arguments
/// * `template_id` - Template identifier (e.g., "daily_standup")
///
/// # Returns
/// TemplateDetails with full template structure
#[tauri::command]
pub async fn api_get_template_details<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
) -> Result<TemplateDetails, String> {
    info!("api_get_template_details called for template_id: {}", template_id);

    let template = templates::get_template(&template_id)?;

    let section_titles: Vec<String> = template
        .sections
        .iter()
        .map(|section| section.title.clone())
        .collect();

    let details = TemplateDetails {
        id: template_id,
        name: template.name,
        description: template.description,
        sections: section_titles,
    };

    info!("Retrieved template details for '{}'", details.name);

    Ok(details)
}

/// Validates a custom template JSON string
///
/// Useful for template editor UI or validation before saving custom templates
///
/// # Arguments
/// * `template_json` - Raw JSON string of the template
///
/// # Returns
/// Ok(template_name) if valid, Err(error_message) if invalid
#[tauri::command]
pub async fn api_validate_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_json: String,
) -> Result<String, String> {
    info!("api_validate_template called");

    match templates::validate_and_parse_template(&template_json) {
        Ok(template) => {
            info!("Template '{}' validated successfully", template.name);
            Ok(template.name)
        }
        Err(e) => {
            warn!("Template validation failed: {}", e);
            Err(e)
        }
    }
}

/// Saves a custom template to the user's templates directory
///
/// Creates or overwrites a custom template. Built-in templates can be overridden
/// by saving a custom template with the same ID.
///
/// # Arguments
/// * `template_id` - Template identifier (alphanumeric + underscores)
/// * `template_json` - Full JSON content of the template
///
/// # Returns
/// Ok(template_name) if saved successfully, Err(error_message) if invalid
#[tauri::command]
pub async fn api_save_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
    template_json: String,
) -> Result<String, String> {
    info!("api_save_template called for template_id: {}", template_id);

    // Validate the ID format
    if template_id.is_empty() {
        return Err("Template ID cannot be empty".to_string());
    }
    if !template_id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err("Template ID must contain only alphanumeric characters, underscores, and hyphens".to_string());
    }

    // Validate and parse the template
    let template = templates::validate_and_parse_template(&template_json)?;

    // Save to custom templates directory
    templates::save_custom_template(&template_id, &template_json)?;

    info!("Template '{}' saved successfully as '{}'", template.name, template_id);
    Ok(template.name)
}

/// Deletes a custom template from the user's templates directory
///
/// Built-in templates cannot be deleted.
///
/// # Arguments
/// * `template_id` - Template identifier to delete
///
/// # Returns
/// Ok(()) if deleted successfully, Err(error_message) if not found or is built-in
#[tauri::command]
pub async fn api_delete_template<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
) -> Result<(), String> {
    info!("api_delete_template called for template_id: {}", template_id);

    templates::delete_custom_template(&template_id)?;

    info!("Template '{}' deleted successfully", template_id);
    Ok(())
}

/// Gets the raw JSON content of a template for editing
///
/// # Arguments
/// * `template_id` - Template identifier
///
/// # Returns
/// Raw JSON string of the template, along with whether it's built-in
#[tauri::command]
pub async fn api_get_template_json<R: Runtime>(
    _app: tauri::AppHandle<R>,
    template_id: String,
) -> Result<TemplateJsonResponse, String> {
    info!("api_get_template_json called for template_id: {}", template_id);

    let json = templates::get_template_json(&template_id)?;
    let is_builtin = templates::is_builtin_template(&template_id);

    Ok(TemplateJsonResponse {
        json,
        is_builtin,
    })
}

/// Response for api_get_template_json
#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateJsonResponse {
    pub json: String,
    pub is_builtin: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_list_templates() {
        // This test requires the templates to be embedded/available
        // In a real test environment, you might want to mock the templates module

        // For now, just verify the function compiles and runs
        // You can expand this with more specific assertions
    }

    #[tokio::test]
    async fn test_validate_template_valid() {
        let valid_json = r#"
        {
            "name": "Test Template",
            "description": "A test template",
            "sections": [
                {
                    "title": "Summary",
                    "instruction": "Provide a summary",
                    "format": "paragraph"
                }
            ]
        }"#;

        // Mock app handle would be needed for actual testing
        // For now, test the validation logic directly
        let result = templates::validate_and_parse_template(valid_json);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_template_invalid() {
        let invalid_json = "invalid json";

        let result = templates::validate_and_parse_template(invalid_json);
        assert!(result.is_err());
    }
}

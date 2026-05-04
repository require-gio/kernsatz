import { useState, useEffect, useCallback } from 'react';
import { invoke as invokeTauri } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';

export function useTemplates() {
  const [availableTemplates, setAvailableTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string;
  }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard_meeting');

  // Fetch available templates
  const fetchTemplates = useCallback(async () => {
    try {
      const templates = await invokeTauri('api_list_templates') as Array<{
        id: string;
        name: string;
        description: string;
      }>;
      console.log('Available templates:', templates);
      setAvailableTemplates(templates);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle template selection
  const handleTemplateSelection = useCallback((templateId: string, templateName: string) => {
    setSelectedTemplate(templateId);
    toast.success('Template ausgewählt', {
      description: `"${templateName}" wird für die Zusammenfassung verwendet`,
    });
    Analytics.trackFeatureUsed('template_selected');
  }, []);

  // Refresh templates after changes (add/edit/delete)
  const refreshTemplates = useCallback(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    availableTemplates,
    selectedTemplate,
    handleTemplateSelection,
    refreshTemplates,
  };
}

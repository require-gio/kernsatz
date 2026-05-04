"use client";

import { ModelConfig, ModelSettingsModal } from '@/components/ModelSettingsModal';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Sparkles, Settings, Loader2, FileText, Check, Square } from 'lucide-react';
import { TemplateManagerDialog } from './TemplateManagerDialog';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';
import { isOllamaNotInstalledError } from '@/lib/utils';
import { BuiltInModelInfo } from '@/lib/builtin-ai';

interface SummaryGeneratorButtonGroupProps {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSaveModelConfig: (config?: ModelConfig) => Promise<void>;
  onGenerateSummary: (customPrompt: string) => Promise<void>;
  onStopGeneration: () => void;
  customPrompt: string;
  summaryStatus: 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';
  availableTemplates: Array<{ id: string, name: string, description: string }>;
  selectedTemplate: string;
  onTemplateSelect: (templateId: string, templateName: string) => void;
  onTemplatesChanged: () => void;
  hasTranscripts?: boolean;
  isModelConfigLoading?: boolean;
  onOpenModelSettings?: (openFn: () => void) => void;
}

export function SummaryGeneratorButtonGroup({
  modelConfig,
  setModelConfig,
  onSaveModelConfig,
  onGenerateSummary,
  onStopGeneration,
  customPrompt,
  summaryStatus,
  availableTemplates,
  selectedTemplate,
  onTemplateSelect,
  onTemplatesChanged,
  hasTranscripts = true,
  isModelConfigLoading = false,
  onOpenModelSettings
}: SummaryGeneratorButtonGroupProps) {
  const [isCheckingModels, setIsCheckingModels] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Expose the function to open the modal via callback registration
  useEffect(() => {
    if (onOpenModelSettings) {
      // Register our open dialog function with the parent by calling the callback
      // This allows the parent to store a reference to this function
      const openDialog = () => {
        console.log('📱 Opening model settings dialog via callback');
        setSettingsDialogOpen(true);
      };

      // Call the parent's callback with our open function
      // Note: This assumes onOpenModelSettings accepts a function parameter
      // We'll need to adjust the signature
      onOpenModelSettings(openDialog);
    }
  }, [onOpenModelSettings]);

  if (!hasTranscripts) {
    return null;
  }

  const checkBuiltInAIModelsAndGenerate = async () => {
    setIsCheckingModels(true);
    try {
      const selectedModel = modelConfig.model;

      // Check if specific model is configured
      if (!selectedModel) {
        toast.error('Kein eingebautes KI-Modell ausgewählt', {
          description: 'Bitte wähle ein Modell in den Einstellungen aus',
          duration: 5000,
        });
        setSettingsDialogOpen(true);
        return;
      }

      // Check model readiness (with filesystem refresh)
      const isReady = await invoke<boolean>('builtin_ai_is_model_ready', {
        modelName: selectedModel,
        refresh: true,
      });

      if (isReady) {
        // Model is available, proceed with generation
        onGenerateSummary(customPrompt);
        return;
      }

      // Model not ready - check detailed status
      const modelInfo = await invoke<BuiltInModelInfo | null>('builtin_ai_get_model_info', {
        modelName: selectedModel,
      });

      if (!modelInfo) {
        toast.error('Modell nicht gefunden', {
          description: `Informationen für Modell ${selectedModel} konnten nicht gefunden werden`,
          duration: 5000,
        });
        setSettingsDialogOpen(true);
        return;
      }

      // Handle different model states
      const status = modelInfo.status;

      if (status.type === 'downloading') {
        toast.info('Modell-Download läuft', {
          description: `${selectedModel} wird heruntergeladen (${status.progress}%). Bitte warte, bis der Download abgeschlossen ist.`,
          duration: 5000,
        });
        return;
      }

      if (status.type === 'not_downloaded') {
        toast.error('Modell nicht heruntergeladen', {
          description: `${selectedModel} muss vor der Verwendung heruntergeladen werden. Modell-Einstellungen werden geöffnet...`,
          duration: 5000,
        });
        setSettingsDialogOpen(true);
        return;
      }

      if (status.type === 'corrupted') {
        toast.error('Modell-Datei beschädigt', {
          description: `${selectedModel}-Datei ist beschädigt. Bitte löschen und erneut herunterladen.`,
          duration: 7000,
        });
        setSettingsDialogOpen(true);
        return;
      }

      if (status.type === 'error') {
        toast.error('Modell-Fehler', {
          description: status.Error || 'Ein Fehler ist mit dem Modell aufgetreten',
          duration: 5000,
        });
        setSettingsDialogOpen(true);
        return;
      }

      // Fallback
      toast.error('Modell nicht verfügbar', {
        description: 'Das ausgewählte Modell ist nicht einsatzbereit',
        duration: 5000,
      });
      setSettingsDialogOpen(true);

    } catch (error) {
      console.error('Error checking built-in AI models:', error);
      toast.error('Modell-Status konnte nicht geprüft werden', {
        description: error instanceof Error ? error.message : String(error),
        duration: 5000,
      });
    } finally {
      setIsCheckingModels(false);
    }
  };

  const checkOllamaModelsAndGenerate = async () => {
    // Handle built-in AI provider
    if (modelConfig.provider === 'builtin-ai') {
      await checkBuiltInAIModelsAndGenerate();
      return;
    }

    // Only check for Ollama provider
    if (modelConfig.provider !== 'ollama') {
      onGenerateSummary(customPrompt);
      return;
    }

    setIsCheckingModels(true);
    try {
      const endpoint = modelConfig.ollamaEndpoint || null;
      const models = await invoke('get_ollama_models', { endpoint }) as any[];

      if (!models || models.length === 0) {
        // No models available, show message and open settings
        toast.error(
          'Keine Ollama-Modelle gefunden. Bitte lade gemma2:2b in den Modell-Einstellungen herunter.',
          { duration: 5000 }
        );
        setSettingsDialogOpen(true);
        return;
      }

      // Models are available, proceed with generation
      onGenerateSummary(customPrompt);
    } catch (error) {
      console.error('Error checking Ollama models:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (isOllamaNotInstalledError(errorMessage)) {
        // Ollama is not installed - show specific message with download link
        toast.error(
          'Ollama ist nicht installiert',
          {
            description: 'Bitte lade Ollama herunter und installiere es, um lokale Modelle zu verwenden.',
            duration: 7000,
            action: {
              label: 'Download',
              onClick: () => invoke('open_external_url', { url: 'https://ollama.com/download' })
            }
          }
        );
      } else {
        // Other error - generic message
        toast.error(
          'Ollama-Modelle konnten nicht geprüft werden. Bitte prüfe, ob Ollama läuft, und lade ein Modell herunter.',
          { duration: 5000 }
        );
      }
      setSettingsDialogOpen(true);
    } finally {
      setIsCheckingModels(false);
    }
  };

  const isGenerating = summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating';

  return (
    <ButtonGroup>
      {/* Generate Summary or Stop button */}
      {isGenerating ? (
        <Button
          variant="outline"
          size="sm"
          className="bg-gradient-to-r from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 border-red-200 xl:px-4"
          onClick={() => {
            Analytics.trackButtonClick('stop_summary_generation', 'meeting_details');
            onStopGeneration();
          }}
          title="Stop summary generation"
        >
          <Square className="xl:mr-2" size={18} fill="currentColor" />
          <span className="hidden lg:inline xl:inline">Stopp</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200 xl:px-4"
          onClick={() => {
            Analytics.trackButtonClick('generate_summary', 'meeting_details');
            checkOllamaModelsAndGenerate();
          }}
          disabled={isCheckingModels || isModelConfigLoading}
          title={
            isModelConfigLoading
              ? 'Modell-Konfiguration wird geladen...'
              : isCheckingModels
                ? 'Modelle werden geprüft...'
                : 'KI-Zusammenfassung erstellen'
          }
        >
          {isCheckingModels || isModelConfigLoading ? (
            <>
              <Loader2 className="animate-spin xl:mr-2" size={18} />
              <span className="hidden xl:inline">Verarbeitung...</span>
            </>
          ) : (
            <>
              <Sparkles className="xl:mr-2" size={18} />
              <span className="hidden lg:inline xl:inline">Zusammenfassung erstellen</span>
            </>
          )}
        </Button>
      )}

      {/* Settings button */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title="Zusammenfassungs-Einstellungen"
          >
            <Settings />
            <span className="hidden lg:inline">KI-Modell</span>
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>Modell-Einstellungen</DialogTitle>
          </VisuallyHidden>
          <ModelSettingsModal
            onSave={async (config) => {
              await onSaveModelConfig(config);
              setSettingsDialogOpen(false);
            }}
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
            skipInitialFetch={true}
          />
        </DialogContent>
      </Dialog>

      {/* Template manager button */}
      <Button
        variant="outline"
        size="sm"
        title="Vorlagen verwalten"
        onClick={() => setTemplateDialogOpen(true)}
      >
        <FileText />
        <span className="hidden lg:inline">Template</span>
      </Button>
      <TemplateManagerDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        availableTemplates={availableTemplates}
        selectedTemplate={selectedTemplate}
        onTemplateSelect={(id, name) => {
          onTemplateSelect(id, name);
        }}
        onTemplatesChanged={onTemplatesChanged}
      />
    </ButtonGroup>
  );
}

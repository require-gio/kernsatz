"use client";

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Check,
  Plus,
  Pencil,
  Copy,
  Trash2,
  ArrowLeft,
  GripVertical,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface TemplateSection {
  title: string;
  instruction: string;
  format: string;
  item_format?: string;
}

interface TemplateData {
  name: string;
  description: string;
  sections: TemplateSection[];
}

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
}

interface TemplateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTemplates: TemplateInfo[];
  selectedTemplate: string;
  onTemplateSelect: (templateId: string, templateName: string) => void;
  onTemplatesChanged: () => void;
}

type View = 'list' | 'editor';

export function TemplateManagerDialog({
  open,
  onOpenChange,
  availableTemplates,
  selectedTemplate,
  onTemplateSelect,
  onTemplatesChanged,
}: TemplateManagerDialogProps) {
  const [view, setView] = useState<View>('list');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isBuiltin, setIsBuiltin] = useState(false);
  const [templateData, setTemplateData] = useState<TemplateData>({
    name: '',
    description: '',
    sections: [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const resetEditor = useCallback(() => {
    setTemplateData({ name: '', description: '', sections: [] });
    setEditingTemplateId(null);
    setIsBuiltin(false);
  }, []);

  const handleNewTemplate = useCallback(() => {
    resetEditor();
    setTemplateData({
      name: '',
      description: '',
      sections: [
        { title: '', instruction: '', format: 'paragraph' },
      ],
    });
    setView('editor');
  }, [resetEditor]);

  const handleEditTemplate = useCallback(async (templateId: string) => {
    try {
      const response = await invoke<{ json: string; is_builtin: boolean }>('api_get_template_json', {
        templateId,
      });
      const data: TemplateData = JSON.parse(response.json);
      setTemplateData(data);
      setIsBuiltin(response.is_builtin);
      setEditingTemplateId(response.is_builtin ? null : templateId);
      setView('editor');
    } catch (error) {
      toast.error('Fehler beim Laden des Templates', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const handleDuplicateTemplate = useCallback(async (templateId: string, templateName: string) => {
    try {
      const response = await invoke<{ json: string; is_builtin: boolean }>('api_get_template_json', {
        templateId,
      });
      const data: TemplateData = JSON.parse(response.json);
      data.name = `${data.name} (Kopie)`;
      setTemplateData(data);
      setIsBuiltin(false);
      setEditingTemplateId(null);
      setView('editor');
    } catch (error) {
      toast.error('Fehler beim Duplizieren', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const handleDeleteTemplate = useCallback(async (templateId: string, templateName: string) => {
    try {
      await invoke('api_delete_template', { templateId });
      toast.success(`Template "${templateName}" gelöscht`);
      onTemplatesChanged();
      // If the deleted template was selected, switch to default
      if (selectedTemplate === templateId) {
        onTemplateSelect('standard_meeting', 'Standard-Meeting');
      }
    } catch (error) {
      toast.error('Fehler beim Löschen', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [onTemplatesChanged, selectedTemplate, onTemplateSelect]);

  const generateTemplateId = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[äöüß]/g, (match) => {
        const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
        return map[match] || match;
      })
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  };

  const handleSaveTemplate = useCallback(async () => {
    // Validate
    if (!templateData.name.trim()) {
      toast.error('Bitte gib einen Namen ein');
      return;
    }
    if (!templateData.description.trim()) {
      toast.error('Bitte gib eine Beschreibung ein');
      return;
    }
    if (templateData.sections.length === 0) {
      toast.error('Mindestens ein Abschnitt ist erforderlich');
      return;
    }
    for (const section of templateData.sections) {
      if (!section.title.trim() || !section.instruction.trim()) {
        toast.error('Alle Abschnitte müssen Titel und Anweisung haben');
        return;
      }
    }

    setIsSaving(true);
    try {
      const templateId = editingTemplateId || generateTemplateId(templateData.name);
      const json = JSON.stringify(templateData, null, 2);

      await invoke<string>('api_save_template', {
        templateId,
        templateJson: json,
      });

      toast.success(`Template "${templateData.name}" gespeichert`);
      onTemplatesChanged();
      setView('list');
      resetEditor();
    } catch (error) {
      toast.error('Fehler beim Speichern', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  }, [templateData, editingTemplateId, onTemplatesChanged, resetEditor]);

  const handleAddSection = useCallback(() => {
    setTemplateData(prev => ({
      ...prev,
      sections: [...prev.sections, { title: '', instruction: '', format: 'paragraph' }],
    }));
  }, []);

  const handleRemoveSection = useCallback((index: number) => {
    setTemplateData(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSectionChange = useCallback((index: number, field: keyof TemplateSection, value: string) => {
    setTemplateData(prev => ({
      ...prev,
      sections: prev.sections.map((section, i) => {
        if (i !== index) return section;
        const updated = { ...section, [field]: value };
        // Clear item_format when format is not "list"
        if (field === 'format' && value !== 'list') {
          delete updated.item_format;
        }
        return updated;
      }),
    }));
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    resetEditor();
  }, [resetEditor]);

  // Check if a template is built-in (cannot be deleted)
  const isTemplateBuiltin = (templateId: string): boolean => {
    return templateId === 'standard_meeting' || templateId === 'daily_standup';
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        setView('list');
        resetEditor();
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" aria-describedby={undefined}>
        <DialogTitle className="flex items-center gap-2">
          {view === 'editor' && (
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 w-7 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {view === 'list' ? 'Vorlagen verwalten' : (editingTemplateId ? 'Template bearbeiten' : (isBuiltin ? 'Template anpassen (Kopie)' : 'Neues Template'))}
        </DialogTitle>

        {view === 'list' ? (
          <TemplateListView
            templates={availableTemplates}
            selectedTemplate={selectedTemplate}
            onSelect={onTemplateSelect}
            onEdit={handleEditTemplate}
            onDuplicate={handleDuplicateTemplate}
            onDelete={handleDeleteTemplate}
            isBuiltin={isTemplateBuiltin}
          />
        ) : (
          <TemplateEditorView
            templateData={templateData}
            setTemplateData={setTemplateData}
            onSave={handleSaveTemplate}
            onCancel={handleBack}
            onAddSection={handleAddSection}
            onRemoveSection={handleRemoveSection}
            onSectionChange={handleSectionChange}
            isSaving={isSaving}
            isBuiltin={isBuiltin}
          />
        )}

        {view === 'list' && (
          <div className="flex justify-start pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleNewTemplate}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Template erstellen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

interface TemplateListViewProps {
  templates: TemplateInfo[];
  selectedTemplate: string;
  onSelect: (id: string, name: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  isBuiltin: (id: string) => boolean;
}

function TemplateListView({
  templates,
  selectedTemplate,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  isBuiltin,
}: TemplateListViewProps) {
  return (
    <ScrollArea className="max-h-[55vh]">
      <div className="space-y-2 pr-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedTemplate === template.id
                ? 'border-blue-300 bg-blue-50/50'
                : 'border-border hover:bg-muted/50'
            }`}
            onClick={() => onSelect(template.id, template.name)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {selectedTemplate === template.id && (
                <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{template.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    isBuiltin(template.id)
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {isBuiltin(template.id) ? 'Eingebaut' : 'Benutzerdefiniert'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {template.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); onEdit(template.id); }}
                title="Bearbeiten"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); onDuplicate(template.id, template.name); }}
                title="Duplizieren"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {!isBuiltin(template.id) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => { e.stopPropagation(); onDelete(template.id, template.name); }}
                  title="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ─── Editor View ─────────────────────────────────────────────────────────────

interface TemplateEditorViewProps {
  templateData: TemplateData;
  setTemplateData: React.Dispatch<React.SetStateAction<TemplateData>>;
  onSave: () => void;
  onCancel: () => void;
  onAddSection: () => void;
  onRemoveSection: (index: number) => void;
  onSectionChange: (index: number, field: keyof TemplateSection, value: string) => void;
  isSaving: boolean;
  isBuiltin: boolean;
}

function TemplateEditorView({
  templateData,
  setTemplateData,
  onSave,
  onCancel,
  onAddSection,
  onRemoveSection,
  onSectionChange,
  isSaving,
  isBuiltin,
}: TemplateEditorViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {isBuiltin && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Dies ist ein eingebautes Template. Änderungen werden als neue benutzerdefinierte Vorlage gespeichert.
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input
            value={templateData.name}
            onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="z.B. Wöchentliches Retrospektive"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Beschreibung</label>
          <Input
            value={templateData.description}
            onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Kurze Beschreibung des Templates"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Abschnitte</label>
        <ScrollArea className="max-h-[40vh] mt-2">
          <div className="space-y-3 pr-4">
            {templateData.sections.map((section, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">
                      Abschnitt {index + 1}
                    </span>
                  </div>
                  {templateData.sections.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      onClick={() => onRemoveSection(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <Input
                  value={section.title}
                  onChange={(e) => onSectionChange(index, 'title', e.target.value)}
                  placeholder="Abschnitt-Titel (z.B. Zusammenfassung)"
                  className="text-sm"
                />

                <Textarea
                  value={section.instruction}
                  onChange={(e) => onSectionChange(index, 'instruction', e.target.value)}
                  placeholder="Anweisung für die KI (z.B. Fasse die Hauptpunkte zusammen)"
                  className="text-sm min-h-[60px]"
                  rows={2}
                />

                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Format:</label>
                  <Select
                    value={section.format}
                    onValueChange={(value) => onSectionChange(index, 'format', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paragraph">Absatz</SelectItem>
                      <SelectItem value="list">Liste / Tabelle</SelectItem>
                      <SelectItem value="string">Einzelwert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {section.format === 'list' && (
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Tabellenformat (optional)
                    </label>
                    <Textarea
                      value={section.item_format || ''}
                      onChange={(e) => onSectionChange(index, 'item_format', e.target.value)}
                      placeholder="z.B. | **Spalte1** | **Spalte2** |&#10;| --- | --- |"
                      className="text-xs min-h-[50px] mt-1 font-mono"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button
          variant="outline"
          size="sm"
          onClick={onAddSection}
          className="mt-2"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Abschnitt hinzufügen
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Speichern...' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
}

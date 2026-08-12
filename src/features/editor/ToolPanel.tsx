import { Crop, Layers3, RotateCw, SlidersHorizontal, Sparkles, ScanLine } from 'lucide-react';
import type { EditRecipe, FilterPreset } from '../../domain/types';
import type { ProjectEditor } from '../../state/useProjectEditor';
import { PagesTool } from './PagesTool';

export type ToolTab = 'crop' | 'filters' | 'adjust' | 'pages';

const FILTERS: Array<{ value: FilterPreset; label: string; swatch: string }> = [
  { value: 'original', label: 'Original', swatch: 'filter-original' },
  { value: 'auto', label: 'Auto Clean', swatch: 'filter-auto' },
  { value: 'color', label: 'Color', swatch: 'filter-color' },
  { value: 'grayscale', label: 'Grayscale', swatch: 'filter-gray' },
  { value: 'black-white', label: 'B & W', swatch: 'filter-bw' },
];

function RangeControl({ label, value, min, max, unit = '', onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span><span>{label}</span><output>{value}{unit}</output></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

interface ToolPanelProps {
  editor: ProjectEditor;
  tab: ToolTab;
  onTab: (tab: ToolTab) => void;
  onScan: () => void;
  onFiles: (files: File[]) => void;
  importDisabled?: boolean;
}

export function ToolPanel({ editor, tab, onTab, onScan, onFiles, importDisabled }: ToolPanelProps) {
  const recipe = editor.activePage?.recipe;
  const tabs: Array<{ value: ToolTab; label: string; icon: typeof Crop }> = [
    { value: 'crop', label: 'Crop', icon: Crop },
    { value: 'filters', label: 'Filters', icon: Sparkles },
    { value: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
    { value: 'pages', label: 'Pages', icon: Layers3 },
  ];
  if (!recipe) return null;
  const patch = <K extends keyof EditRecipe>(key: K, value: EditRecipe[K]) => editor.updateRecipe({ [key]: value });

  return (
    <aside className="tool-panel">
      <div className="tool-tabs" role="tablist">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button key={value} className={tab === value ? 'is-active' : ''} onClick={() => onTab(value)} role="tab" aria-selected={tab === value}>
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className={`tool-content ${tab === 'pages' ? 'pages-content' : ''}`}>
        {tab === 'crop' && (
          <div className="tool-section">
            <div className="tool-heading"><div><ScanLine size={18} /><strong>Page shape</strong></div><span>Drag the four corners</span></div>
            <RangeControl label="Straighten" value={recipe.straighten} min={-10} max={10} unit="°" onChange={(value) => patch('straighten', value)} />
            <button className="button secondary full" onClick={editor.rotateSelected}><RotateCw size={17} /> Rotate 90°</button>
          </div>
        )}
        {tab === 'filters' && (
          <div className="tool-section">
            <div className="filter-grid">
              {FILTERS.map((filter) => (
                <button key={filter.value} className={`filter-choice ${recipe.preset === filter.value ? 'is-active' : ''}`} onClick={() => patch('preset', filter.value)}>
                  <span className={`filter-swatch ${filter.swatch}`} /><span>{filter.label}</span>
                </button>
              ))}
            </div>
            <RangeControl label="Filter intensity" value={recipe.intensity} min={0} max={100} unit="%" onChange={(value) => patch('intensity', value)} />
          </div>
        )}
        {tab === 'adjust' && (
          <div className="tool-section">
            <RangeControl label="Brightness" value={recipe.brightness} min={-50} max={50} onChange={(value) => patch('brightness', value)} />
            <RangeControl label="Contrast" value={recipe.contrast} min={-50} max={50} onChange={(value) => patch('contrast', value)} />
            <RangeControl label="Sharpness" value={recipe.sharpen} min={0} max={100} unit="%" onChange={(value) => patch('sharpen', value)} />
          </div>
        )}
        {tab === 'pages' && (
          <PagesTool editor={editor} onScan={onScan} onFiles={onFiles} importDisabled={importDisabled} />
        )}
      </div>
      {tab !== 'pages' && <div className="tool-footer">
        <button onClick={editor.resetSelected}>Reset selected</button>
        <button onClick={editor.applyActiveToAll}>Apply page to all</button>
      </div>}
    </aside>
  );
}

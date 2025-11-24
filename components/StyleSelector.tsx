import React from 'react';
import { ART_STYLES, ArtStyle } from '../types';

interface StyleSelectorProps {
  selectedStyleId: string;
  onSelect: (id: string) => void;
  customStylePrompt?: string;
  onCustomStyleChange?: (prompt: string) => void;
  variant?: 'default' | 'compact';
}

const StyleSelector: React.FC<StyleSelectorProps> = ({ 
  selectedStyleId, 
  onSelect,
  customStylePrompt = "",
  onCustomStyleChange,
  variant = 'default'
}) => {
  const isCompact = variant === 'compact';

  return (
    <div className={`flex flex-col ${isCompact ? 'mb-0' : 'mb-6 gap-4'}`}>
      <div className={`
        ${isCompact 
            ? 'flex overflow-x-auto pb-2 gap-2 scrollbar-hide -mx-2 px-2 items-center' 
            : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'}
      `}>
        {ART_STYLES.map((style: ArtStyle) => {
          const isSelected = selectedStyleId === style.id;
          return (
            <button
              key={style.id}
              onClick={() => onSelect(style.id)}
              className={`
                relative overflow-hidden rounded-xl text-left transition-all duration-300 border-2 flex-shrink-0
                ${isCompact ? 'w-28 h-12 p-2' : 'p-4 h-24'}
                ${isSelected ? 'border-white scale-105 shadow-lg shadow-purple-500/20' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}
              `}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${style.previewColor} opacity-50 z-0`}></div>
              <div className="relative z-10 font-bold text-white shadow-black drop-shadow-md leading-tight flex items-center h-full">
                 <span className={`${isCompact ? 'text-xs truncate w-full' : 'text-sm md:text-base'}`}>{style.name}</span>
              </div>
              {isSelected && (
                <div className={`absolute ${isCompact ? 'top-1 right-1' : 'bottom-2 right-2'} z-10 bg-white text-black rounded-full p-0.5`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedStyleId === 'custom' && onCustomStyleChange && (
        <div className="animate-fade-in mt-2">
           {!isCompact && (
              <label className="block text-slate-300 text-sm font-semibold mb-2">
                Describe your custom art style
              </label>
           )}
          <input
            type="text"
            value={customStylePrompt}
            onChange={(e) => onCustomStyleChange(e.target.value)}
            placeholder={isCompact ? "Describe custom style..." : "E.g., Oil painting in the style of Van Gogh, thick brush strokes, vibrant starry night colors..."}
            className={`
                w-full bg-slate-900 border border-indigo-500/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all
                ${isCompact ? 'p-2 text-sm border-indigo-500/30' : 'p-3'}
            `}
          />
        </div>
      )}
    </div>
  );
};

export default StyleSelector;
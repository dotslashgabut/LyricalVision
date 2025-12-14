import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import StyleSelector from './components/StyleSelector';
import StanzaCard from './components/StanzaCard';
import { ART_STYLES, Stanza, IMAGE_MODELS, ASPECT_RATIOS, AspectRatio } from './types';
import { generateStanzaImage } from './services/geminiService';

const App: React.FC = () => {
  const [lyricsInput, setLyricsInput] = useState<string>('');
  const [contextInput, setContextInput] = useState<string>('');
  const [stanzas, setStanzas] = useState<Stanza[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(ART_STYLES[0].id);
  const [selectedModelId, setSelectedModelId] = useState<string>(IMAGE_MODELS[0].id);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
  const [customStylePrompt, setCustomStylePrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // 'hasSelectedKey' tracks if the user specifically chose a paid key (required for Pro)
  const [hasSelectedKey, setHasSelectedKey] = useState<boolean>(false);

  useEffect(() => {
    const checkApiKey = async () => {
        const aistudio = (window as any).aistudio;
        if (aistudio && aistudio.hasSelectedApiKey) {
            const hasKey = await aistudio.hasSelectedApiKey();
            setHasSelectedKey(hasKey);
        }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && aistudio.openSelectKey) {
          await aistudio.openSelectKey();
          setHasSelectedKey(true);
      }
  };

  // Determine if we need to enforce the paid key check
  const isProModel = selectedModelId === 'gemini-3-pro-image-preview';
  const requiresKeySelection = isProModel && !hasSelectedKey;

  // Split lyrics into stanzas based on double newlines
  const handleProcessLyrics = () => {
    if (!lyricsInput.trim()) return;

    setIsProcessing(true);
    
    // Normalize line endings and split by double newline
    const rawStanzas = lyricsInput
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const newStanzas: Stanza[] = rawStanzas.map(text => ({
      id: uuidv4(),
      text,
      isLoading: false,
    }));

    setStanzas(newStanzas);
    setIsProcessing(false);
  };

  const handleDeleteStanza = (id: string) => {
    setStanzas(prev => prev.filter(stanza => stanza.id !== id));
  };

  const handleGenerateImage = useCallback(async (stanzaId: string) => {
    // Only block generation if using Pro model without a selected key
    if (selectedModelId === 'gemini-3-pro-image-preview' && !hasSelectedKey) {
        await handleSelectKey();
        // Since key selection is async and might be cancelled, we pause here.
        // If successful, the user can click generate again.
        return;
    }

    const stanza = stanzas.find(s => s.id === stanzaId);
    if (!stanza) return;

    const style = ART_STYLES.find(s => s.id === selectedStyleId);
    if (!style) return;

    // Determine the actual prompt to use
    let stylePrompt = style.promptModifier;
    if (selectedStyleId === 'custom') {
        stylePrompt = customStylePrompt;
    }

    // Update state to loading
    setStanzas(prev => prev.map(s => 
      s.id === stanzaId ? { ...s, isLoading: true, error: undefined } : s
    ));

    try {
      const base64Image = await generateStanzaImage(
        stanza.text,
        stylePrompt,
        contextInput,
        selectedModelId,
        selectedAspectRatio
      );

      setStanzas(prev => prev.map(s => 
        s.id === stanzaId ? { ...s, isLoading: false, imageUrl: base64Image } : s
      ));
    } catch (error: any) {
      setStanzas(prev => prev.map(s => 
        s.id === stanzaId ? { ...s, isLoading: false, error: error.message || "Failed to generate. Try again." } : s
      ));
    }
  }, [stanzas, selectedStyleId, customStylePrompt, contextInput, selectedModelId, selectedAspectRatio, hasSelectedKey]);

  const handleClear = () => {
    setStanzas([]);
    setLyricsInput('');
    setContextInput('');
    setCustomStylePrompt('');
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 h-[65px]">
        <div className="max-w-4xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Lyrical Vision</h1>
          </div>
          <div className="flex items-center gap-3">
             {/* Key Status Indicator - Only show if Pro is selected and no key */}
             {requiresKeySelection && (
                 <button onClick={handleSelectKey} className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10">
                    ⚠ Select API Key
                 </button>
             )}
            {stanzas.length > 0 && (
                <button 
                    onClick={handleClear}
                    className="text-xs md:text-sm font-medium text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 px-3 py-1.5 rounded-full"
                >
                    New Project
                </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        
        {/* Input Phase */}
        {stanzas.length === 0 ? (
          <div className="animate-fade-in-up">
            <div className="mb-8 text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
                Turn your music into <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">visual art</span>.
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Select a style, provide context, paste your lyrics, and generate consistent imagery using Gemini.
              </p>
            </div>

            <div className="mb-4">
                <label className="block text-slate-300 text-sm font-semibold mb-2">1. Select Art Style</label>
                <StyleSelector 
                  selectedStyleId={selectedStyleId} 
                  onSelect={setSelectedStyleId} 
                  customStylePrompt={customStylePrompt}
                  onCustomStyleChange={setCustomStylePrompt}
                />
            </div>
            
            <div className="mb-6">
                <label className="block text-slate-300 text-sm font-semibold mb-2">2. Generation Settings</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Model Selector */}
                  <div className="space-y-2">
                     <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Model</span>
                     <div className="grid grid-cols-1 gap-2">
                      {IMAGE_MODELS.map(model => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModelId(model.id)}
                          className={`
                            px-4 py-3 rounded-xl border transition-all relative overflow-hidden flex items-center justify-between
                            ${selectedModelId === model.id 
                              ? 'border-purple-500 bg-slate-800 shadow-lg shadow-purple-900/10' 
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}
                          `}
                        >
                           <div className="flex flex-col items-start">
                             <span className={`font-bold text-sm ${selectedModelId === model.id ? 'text-white' : 'text-slate-300'}`}>
                                {model.name}
                             </span>
                             <span className="text-[10px] text-slate-400">{model.description.split(',')[0]}</span>
                           </div>
                           {model.badge && (
                              <span className={`
                                text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ml-2
                                ${model.badge === 'Pro' 
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black' 
                                  : 'bg-slate-600 text-slate-200'}
                              `}>
                                {model.badge}
                              </span>
                            )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio Selector */}
                  <div className="space-y-2">
                     <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Aspect Ratio</span>
                     <div className="flex flex-wrap gap-2">
                        {ASPECT_RATIOS.map(ratio => (
                            <button
                                key={ratio}
                                onClick={() => setSelectedAspectRatio(ratio)}
                                className={`
                                    flex-1 min-w-[60px] h-[50px] rounded-xl border flex flex-col items-center justify-center transition-all
                                    ${selectedAspectRatio === ratio 
                                        ? 'bg-slate-800 border-purple-500 text-white shadow-lg shadow-purple-900/10' 
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}
                                `}
                            >
                                <span className="text-sm font-bold">{ratio}</span>
                                <span className="text-[9px] opacity-60">
                                    {ratio === '1:1' ? 'Square' : 
                                     ratio === '16:9' ? 'Landscape' : 
                                     ratio === '9:16' ? 'Portrait' : 
                                     ratio === '4:3' ? 'Classic' : 'Tall'}
                                </span>
                            </button>
                        ))}
                     </div>
                  </div>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="mb-6">
                 <label className="block text-slate-300 text-sm font-semibold mb-2">
                    3. Visual Context (Optional)
                    <span className="block text-xs font-normal text-slate-500 mt-1">Helps keep images consistent (e.g., "A lonely astronaut on Mars", "Neon Tokyo in rain").</span>
                 </label>
                 <input 
                    type="text"
                    value={contextInput}
                    onChange={(e) => setContextInput(e.target.value)}
                    placeholder="E.g. A sad robot walking through a forest..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                 />
              </div>

              <div className="mb-6">
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  4. Song Lyrics
                  <span className="block text-xs font-normal text-slate-500 mt-1">Separate stanzas with an empty line.</span>
                </label>
                <textarea
                  value={lyricsInput}
                  onChange={(e) => setLyricsInput(e.target.value)}
                  placeholder={`Verse 1:
I'm walking down the street
Lights are flashing on my feet

Chorus:
And I know...`}
                  className="w-full h-48 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono text-sm leading-relaxed resize-y"
                />
              </div>

              {/* Dynamic Button: Changes based on Model Requirement */}
              {requiresKeySelection ? (
                 <button
                    onClick={handleSelectKey}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Select API Key for Pro Model
                 </button>
              ) : (
                 <button
                    onClick={handleProcessLyrics}
                    disabled={!lyricsInput.trim() || isProcessing}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                 >
                    Start Visualizing
                 </button>
              )}
              
              {requiresKeySelection && (
                  <div className="mt-4 text-center text-xs text-slate-500">
                    <p>To use the high-quality Gemini 3.0 Pro Image model, you must select a paid API key.</p>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 underline mt-1 inline-block">View Billing Documentation</a>
                  </div>
              )}
            </div>
          </div>
        ) : (
          /* Results Phase */
          <div className="animate-fade-in relative">
             {/* Sticky Settings Bar */}
             <div className="sticky top-[64px] z-40 -mx-6 px-6 py-3 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 shadow-2xl mb-8 transition-all">
                <div className="max-w-4xl mx-auto flex flex-col gap-3">
                     <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 10v6.178A2 2 0 1110 14.243zm0-4.636l2.828-2.829 1.415 1.415L11.414 11H10v-1.393z" clipRule="evenodd" />
                            </svg>
                            Settings
                        </div>
                        {/* Compact Settings in Header */}
                         <div className="flex items-center gap-2">
                             {/* Model Selector */}
                             <div className="flex bg-slate-800 rounded-lg p-0.5">
                               {IMAGE_MODELS.map(model => (
                                 <button
                                   key={model.id}
                                   onClick={() => setSelectedModelId(model.id)}
                                   className={`
                                     text-[10px] px-2 py-1 rounded-md font-medium transition-all
                                     ${selectedModelId === model.id ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}
                                   `}
                                 >
                                   {model.badge || model.name.split(' ')[2]}
                                 </button>
                               ))}
                             </div>

                             <div className="w-px h-4 bg-slate-700 mx-1"></div>

                             {/* Aspect Ratio Selector */}
                             <div className="flex bg-slate-800 rounded-lg p-0.5">
                               {ASPECT_RATIOS.map(ratio => (
                                 <button
                                   key={ratio}
                                   onClick={() => setSelectedAspectRatio(ratio)}
                                   className={`
                                     text-[10px] px-2 py-1 rounded-md font-medium transition-all
                                     ${selectedAspectRatio === ratio ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}
                                   `}
                                 >
                                   {ratio}
                                 </button>
                               ))}
                             </div>
                         </div>
                     </div>
                    
                    <StyleSelector 
                        selectedStyleId={selectedStyleId} 
                        onSelect={setSelectedStyleId} 
                        customStylePrompt={customStylePrompt}
                        onCustomStyleChange={setCustomStylePrompt}
                        variant="compact"
                    />
                    
                     <div className="relative">
                        <input 
                            type="text"
                            value={contextInput}
                            onChange={(e) => setContextInput(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pl-9 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Global visual context (e.g. 'Cyberpunk city, raining')..."
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                     </div>
                     
                     {/* Warning if switching to Pro without key in results view */}
                     {requiresKeySelection && (
                         <div className="bg-amber-900/30 border border-amber-500/30 rounded p-2 flex items-center justify-between">
                            <span className="text-xs text-amber-200">Gemini 3.0 Pro requires a paid API key.</span>
                            <button onClick={handleSelectKey} className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded">Select Key</button>
                         </div>
                     )}
                </div>
             </div>

            <div className="space-y-8 pt-2">
              {stanzas.map((stanza, index) => (
                <StanzaCard
                  key={stanza.id}
                  stanza={stanza}
                  onGenerate={handleGenerateImage}
                  onDelete={handleDeleteStanza}
                  index={index}
                />
              ))}
            </div>
            
            <div className="text-center text-slate-500 text-xs mt-12 pb-8">
                Generated with {IMAGE_MODELS.find(m => m.id === selectedModelId)?.name} • {selectedAspectRatio} • {stanzas.length} Stanzas
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
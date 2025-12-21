import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import StyleSelector from './components/StyleSelector';
import StanzaCard from './components/StanzaCard';
import { ART_STYLES, Stanza, IMAGE_MODELS, ASPECT_RATIOS, AspectRatio } from './types';
import { generateStanzaImage } from './services/geminiService';

const App: React.FC = () => {
  const [lyricsInput, setLyricsInput] = useState<string>('');
  const [contextInput, setContextInput] = useState<string>('');
  const [subjectInput, setSubjectInput] = useState<string>('');
  const [referenceImages, setReferenceImages] = useState<{ data: string; mimeType: string; id: string }[]>([]);
  const [stanzas, setStanzas] = useState<Stanza[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(ART_STYLES[0].id);
  const [selectedModelId, setSelectedModelId] = useState<string>(IMAGE_MODELS[0].id);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
  const [customStylePrompt, setCustomStylePrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const [hasSelectedKey, setHasSelectedKey] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
        const aistudio = (window as any).aistudio;
        if (aistudio && aistudio.hasSelectedApiKey) {
            const hasKey = await aistudio.hasSelectedApiKey();
            setHasSelectedKey(hasKey);
        } else if (process.env.API_KEY) {
            setHasSelectedKey(true);
        }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && aistudio.openSelectKey) {
          await aistudio.openSelectKey();
          // Assume the key selection was successful after triggering openSelectKey() to mitigate race conditions
          setHasSelectedKey(true);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        if (referenceImages.length >= 3) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setReferenceImages(prev => [
            ...prev, 
            { data: base64, mimeType: file.type, id: uuidv4() }
          ].slice(0, 3));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeReferenceImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isProModel = selectedModelId === 'gemini-3-pro-image-preview';
  const requiresKeySelection = isProModel && !hasSelectedKey;

  const handleProcessLyrics = () => {
    if (!lyricsInput.trim()) return;

    setIsProcessing(true);
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
    if (selectedModelId === 'gemini-3-pro-image-preview' && !hasSelectedKey) {
        await handleSelectKey();
        return;
    }

    const stanza = stanzas.find(s => s.id === stanzaId);
    if (!stanza) return;

    const style = ART_STYLES.find(s => s.id === selectedStyleId);
    if (!style) return;

    let stylePrompt = style.promptModifier;
    if (selectedStyleId === 'custom') {
        stylePrompt = customStylePrompt;
    }

    setStanzas(prev => prev.map(s => 
      s.id === stanzaId ? { ...s, isLoading: true, error: undefined } : s
    ));

    try {
      const base64Images = referenceImages.map(img => ({ data: img.data, mimeType: img.mimeType }));
      const base64Image = await generateStanzaImage(
        stanza.text,
        stylePrompt,
        contextInput,
        subjectInput,
        selectedModelId,
        selectedAspectRatio,
        base64Images.length > 0 ? base64Images : undefined
      );

      setStanzas(prev => prev.map(s => 
        s.id === stanzaId ? { ...s, isLoading: false, imageUrl: base64Image } : s
      ));
    } catch (error: any) {
      let errorMessage = error.message || "Failed to generate.";
      
      if (errorMessage.includes("Requested entity was not found.")) {
        setHasSelectedKey(false);
        errorMessage = "Pro API Key session expired. Please re-select your key.";
        handleSelectKey();
      } else if (errorMessage.includes("429")) {
        errorMessage = "Rate limit reached (15/min). Wait a moment.";
      }
      
      setStanzas(prev => prev.map(s => 
        s.id === stanzaId ? { ...s, isLoading: false, error: errorMessage } : s
      ));
    }
  }, [stanzas, selectedStyleId, customStylePrompt, contextInput, subjectInput, referenceImages, selectedModelId, selectedAspectRatio, hasSelectedKey]);

  const handleClear = () => {
    setStanzas([]);
    setLyricsInput('');
    setContextInput('');
    setSubjectInput('');
    setReferenceImages([]);
    setCustomStylePrompt('');
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 h-[65px]">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight text-shadow">Lyrical Vision</h1>
          </div>
          <div className="flex items-center gap-3">
             {requiresKeySelection && (
                 <button onClick={handleSelectKey} className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 transition-colors">
                    ⚠ Select Pro API Key
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        {stanzas.length === 0 ? (
          <div className="animate-fade-in-up">
            <div className="mb-8 text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
                Visualize lyrics with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Gemini Flash</span>.
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Maintain visual consistency across an entire song by defining a global theme, main subject, and multiple reference images.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700 text-[10px] md:text-xs text-slate-400 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Free Tier: 15 images/min • 1,500 images/day</span>
              </div>
            </div>

            <div className="mb-4">
                <label className="block text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
                   <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px]">1</span>
                   Select Art Style
                </label>
                <StyleSelector 
                  selectedStyleId={selectedStyleId} 
                  onSelect={setSelectedStyleId} 
                  customStylePrompt={customStylePrompt}
                  onCustomStyleChange={setCustomStylePrompt}
                />
            </div>
            
            <div className="mb-6">
                <label className="block text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
                   <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px]">2</span>
                   Generation Settings
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Model Tier</span>
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
                             <span className="text-[10px] text-slate-400">{model.description.split('.')[0]}</span>
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

                  <div className="space-y-2">
                     <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Aspect Ratio</span>
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
                                    {ratio === '1:1' ? 'Square' : ratio === '16:9' ? 'Wide' : ratio === '9:16' ? 'Tall' : ratio === '4:3' ? 'Photo' : 'Cinema'}
                                </span>
                            </button>
                        ))}
                     </div>
                  </div>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px]">3</span>
                        Visual Context
                    </label>
                    <input 
                        type="text"
                        value={contextInput}
                        onChange={(e) => setContextInput(e.target.value)}
                        placeholder="Atmosphere, environment..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px]">4</span>
                        Main Subject
                    </label>
                    <input 
                        type="text"
                        value={subjectInput}
                        onChange={(e) => setSubjectInput(e.target.value)}
                        placeholder="Character, central object..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                    />
                 </div>
              </div>

              <div>
                 <label className="block text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px]">5</span>
                    Reference Images (Up to 3)
                 </label>
                 <div className="grid grid-cols-4 gap-4 items-start">
                    {referenceImages.map((img) => (
                        <div key={img.id} className="relative group aspect-square">
                            <img 
                                src={`data:${img.mimeType};base64,${img.data}`} 
                                className="w-full h-full object-cover rounded-xl border border-purple-500/50 shadow-md transition-transform hover:scale-[1.05]"
                                alt="Reference"
                            />
                            <button 
                                onClick={() => removeReferenceImage(img.id)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-400 transition-colors z-10"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                    
                    {referenceImages.length < 3 && (
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square border-2 border-dashed border-slate-700 hover:border-purple-500/50 hover:bg-slate-700/30 rounded-xl p-2 transition-all flex flex-col items-center justify-center gap-1 group overflow-hidden"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-[10px] text-slate-500 font-medium">Add Image</span>
                        </button>
                    )}
                    
                    <div className="col-span-4 mt-1">
                        <p className="text-[10px] text-slate-500 leading-tight italic bg-slate-900/30 p-2 rounded-lg border border-slate-700/50">
                           <span className="text-purple-400 font-bold uppercase mr-1">Tip:</span> 
                           Upload multiple images to synthesize a unique style or character. For example: Image 1 for face, Image 2 for costume, Image 3 for art medium.
                        </p>
                    </div>
                 </div>
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*" 
                    multiple
                 />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px]">6</span>
                  Song Lyrics
                </label>
                <textarea
                  value={lyricsInput}
                  onChange={(e) => setLyricsInput(e.target.value)}
                  placeholder={`Verse 1:
Yesterday all my troubles seemed so far away

Chorus:
I believe in yesterday...`}
                  className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono text-sm leading-relaxed resize-y shadow-inner"
                />
              </div>

              {requiresKeySelection ? (
                 <button
                    onClick={handleSelectKey}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Setup API Key for Pro
                 </button>
              ) : (
                 <button
                    onClick={handleProcessLyrics}
                    disabled={!lyricsInput.trim() || isProcessing}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-900/30"
                 >
                    Start Visualizing
                 </button>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in relative">
             <div className="sticky top-[64px] z-40 -mx-6 px-6 py-3 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 shadow-2xl mb-8 transition-all">
                <div className="max-w-6xl mx-auto flex flex-col gap-3">
                     <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 10v6.178A2 2 0 1110 14.243zm0-4.636l2.828-2.829 1.415 1.415L11.414 11H10v-1.393z" clipRule="evenodd" />
                            </svg>
                            Continuity Setup
                        </div>
                         <div className="flex items-center gap-2">
                             <div className="flex bg-slate-800 rounded-lg p-0.5">
                               {IMAGE_MODELS.map(model => (
                                 <button
                                   key={model.id}
                                   onClick={() => setSelectedModelId(model.id)}
                                   className={`
                                     text-[9px] px-2 py-1 rounded-md font-medium transition-all
                                     ${selectedModelId === model.id ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}
                                   `}
                                 >
                                   {model.badge}
                                 </button>
                               ))}
                             </div>
                             <div className="w-px h-4 bg-slate-700 mx-1"></div>
                             <div className="flex bg-slate-800 rounded-lg p-0.5">
                               {ASPECT_RATIOS.map(ratio => (
                                 <button
                                   key={ratio}
                                   onClick={() => setSelectedAspectRatio(ratio)}
                                   className={`
                                     text-[9px] px-2 py-1 rounded-md font-medium transition-all
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
                    
                     <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                            <input 
                                type="text"
                                value={contextInput}
                                onChange={(e) => setContextInput(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pl-9 text-[10px] text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="Global Theme/Context..."
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="relative">
                            <input 
                                type="text"
                                value={subjectInput}
                                onChange={(e) => setSubjectInput(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pl-9 text-[10px] text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                                placeholder="Main Subject/Character..."
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                     </div>

                     <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                         {referenceImages.map(img => (
                             <div key={img.id} className="flex-shrink-0 flex items-center gap-1 bg-slate-800 border border-purple-500/30 rounded-lg px-1.5 py-0.5 shadow-sm">
                                 <img src={`data:${img.mimeType};base64,${img.data}`} className="w-4 h-4 rounded object-cover" alt="Ref" />
                                 <button onClick={() => removeReferenceImage(img.id)} className="text-red-400 hover:text-red-300 p-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                 </button>
                             </div>
                         ))}
                         {referenceImages.length < 3 && (
                            <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 hover:border-slate-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-[9px] text-slate-400">Add Ref</span>
                            </button>
                         )}
                         <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
                     </div>
                     
                     {requiresKeySelection && (
                         <div className="bg-amber-900/30 border border-amber-500/30 rounded p-2 flex items-center justify-between shadow-inner">
                            <span className="text-[10px] text-amber-200">Gemini Pro requires a paid key.</span>
                            <button onClick={handleSelectKey} className="text-[9px] bg-amber-600 hover:bg-amber-500 text-white px-2 py-0.5 rounded transition-colors">Select Key</button>
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
            
            <div className="text-center text-slate-500 text-[10px] mt-12 pb-8 uppercase tracking-widest font-semibold opacity-50">
                Generated with {IMAGE_MODELS.find(m => m.id === selectedModelId)?.name} • {selectedAspectRatio} • {stanzas.length} Stanzas
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
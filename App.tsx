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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  
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

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSelectKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && aistudio.openSelectKey) {
          await aistudio.openSelectKey();
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

  const copyStoryboardMarkdown = () => {
    const style = ART_STYLES.find(s => s.id === selectedStyleId);
    const model = IMAGE_MODELS.find(m => m.id === selectedModelId);
    
    let md = `# Lyrical Vision Storyboard\n\n`;
    md += `**Style:** ${style?.name}${selectedStyleId === 'custom' ? ` (${customStylePrompt})` : ''}\n`;
    md += `**Model:** ${model?.name}\n`;
    md += `**Context:** ${contextInput || 'None'}\n`;
    md += `**Subject:** ${subjectInput || 'None'}\n\n`;
    md += `---\n\n`;

    stanzas.forEach((s, i) => {
      md += `### Stanza ${i + 1}\n\n`;
      md += `> ${s.text.replace(/\n/g, '\n> ')}\n\n`;
      if (s.imageUrl) {
        md += `![Visualization ${i + 1}](${s.imageUrl})\n\n`;
      } else {
        md += `*No image generated for this stanza.*\n\n`;
      }
      md += `---\n\n`;
    });

    navigator.clipboard.writeText(md);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleDownloadAll = async () => {
      for (const stanza of stanzas) {
          if (stanza.imageUrl) {
              const index = stanzas.indexOf(stanza);
              const link = document.createElement('a');
              link.href = stanza.imageUrl;
              link.download = `lyrical-vision-stanza-${index + 1}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              // Small delay to ensure the browser processes each download
              await new Promise(resolve => setTimeout(resolve, 300));
          }
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 h-[65px]">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => stanzas.length > 0 && setStanzas([])}>
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
            
            <div className="flex items-center gap-2">
                {stanzas.length > 0 && (
                    <>
                      <button 
                          onClick={handleDownloadAll}
                          className="text-xs md:text-sm font-medium text-slate-300 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-slate-700/50 shadow-sm"
                          title="Download All Generated Images"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="hidden sm:inline">Download All</span>
                      </button>
                      <button 
                          onClick={copyStoryboardMarkdown}
                          className={`text-xs md:text-sm font-medium transition-all px-3 py-1.5 rounded-full flex items-center gap-1.5 border shadow-sm ${copyStatus === 'copied' ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/50'}`}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          <span>{copyStatus === 'copied' ? 'Copied MD!' : 'Copy Storyboard'}</span>
                      </button>
                      <button 
                          onClick={() => setStanzas([])}
                          className="text-xs md:text-sm font-medium text-slate-300 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-slate-700/50 shadow-sm"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                          </svg>
                          <span className="hidden sm:inline">Reset</span>
                          <span className="sm:hidden">Back</span>
                      </button>
                    </>
                )}

                <button 
                  onClick={toggleFullscreen}
                  className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 rounded-full border border-slate-700/50 shadow-sm"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5 0m-5 0l0 5m11 0l5-5m0 0h-5m5 0v5m-5 6l5 5m0 0h-5m5 0v-5M9 15l-5 5m0 0h5m-5 0v-5" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {stanzas.length === 0 ? (
          <div className="animate-fade-in-up">
            <div className="mb-8 text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight text-shadow-lg">
                Visualize lyrics with <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Gemini AI</span>.
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
                           Upload multiple images to synthesize a unique style or character.
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
                  placeholder={`Verse 1:\nYesterday all my troubles seemed so far away\n\nChorus:\nI believe in yesterday...`}
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
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-purple-900/30"
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
                             <div key={img.id} className="flex-shrink-0 flex items-center gap-1.5 bg-slate-800 border border-purple-500/30 rounded-xl px-2 py-1 shadow-sm">
                                 <img src={`data:${img.mimeType};base64,${img.data}`} className="w-8 h-8 rounded-lg object-cover shadow-inner" alt="Ref" />
                                 <button onClick={() => removeReferenceImage(img.id)} className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 rounded-md transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                 </button>
                             </div>
                         ))}
                         {referenceImages.length < 3 && (
                            <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1 hover:border-slate-500 transition-colors h-10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-[10px] text-slate-400 font-medium">Add Ref</span>
                            </button>
                         )}
                         <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
                     </div>
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
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
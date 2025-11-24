import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import StyleSelector from './components/StyleSelector';
import StanzaCard from './components/StanzaCard';
import { ART_STYLES, Stanza } from './types';
import { generateStanzaImage } from './services/geminiService';

const App: React.FC = () => {
  const [lyricsInput, setLyricsInput] = useState<string>('');
  const [contextInput, setContextInput] = useState<string>('');
  const [stanzas, setStanzas] = useState<Stanza[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(ART_STYLES[0].id);
  const [customStylePrompt, setCustomStylePrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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
        contextInput
      );

      setStanzas(prev => prev.map(s => 
        s.id === stanzaId ? { ...s, isLoading: false, imageUrl: base64Image } : s
      ));
    } catch (error: any) {
      setStanzas(prev => prev.map(s => 
        s.id === stanzaId ? { ...s, isLoading: false, error: "Failed to generate. Try again." } : s
      ));
    }
  }, [stanzas, selectedStyleId, customStylePrompt, contextInput]);

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
          {stanzas.length > 0 && (
            <button 
                onClick={handleClear}
                className="text-xs md:text-sm font-medium text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 px-3 py-1.5 rounded-full"
            >
                New Project
            </button>
          )}
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
                Select a style, provide context, paste your lyrics, and generate consistent imagery for every stanza.
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

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="mb-6">
                 <label className="block text-slate-300 text-sm font-semibold mb-2">
                    2. Visual Context (Optional)
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
                  3. Song Lyrics
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

              <button
                onClick={handleProcessLyrics}
                disabled={!lyricsInput.trim() || isProcessing}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
              >
                Start Visualizing
              </button>
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
                            Style Settings
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
                Generated with Gemini AI • {stanzas.length} Stanzas
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
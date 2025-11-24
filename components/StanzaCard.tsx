import React from 'react';
import { Stanza } from '../types';

interface StanzaCardProps {
  stanza: Stanza;
  onGenerate: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

const StanzaCard: React.FC<StanzaCardProps> = ({ stanza, onGenerate, onDelete, index }) => {
  
  const handleDownload = () => {
    if (stanza.imageUrl) {
        const link = document.createElement('a');
        link.href = stanza.imageUrl;
        link.download = `lyrical-vision-stanza-${index + 1}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-xl hover:shadow-2xl transition-all duration-300 mb-6 group">
      {/* Lyric Section */}
      <div className="p-6 md:w-1/2 flex flex-col justify-center relative">
        
        {/* Delete Button */}
        <button
            onClick={() => onDelete(stanza.id)}
            className="absolute top-3 left-3 p-2 text-slate-600 hover:text-red-400 hover:bg-slate-700/50 rounded-full transition-all z-10"
            title="Delete Stanza"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>

        <div className="absolute top-5 left-14 text-xs font-bold text-slate-500 uppercase tracking-widest">
          Stanza {index + 1}
        </div>
        
        <p className="text-lg md:text-xl text-slate-200 font-medium whitespace-pre-line leading-relaxed italic mt-6">
          "{stanza.text}"
        </p>
        
        <div className="mt-6 flex items-center gap-3">
            <button
                onClick={() => onGenerate(stanza.id)}
                disabled={stanza.isLoading}
                className={`
                    px-5 py-2.5 rounded-full font-semibold text-sm transition-all flex items-center gap-2
                    ${stanza.isLoading 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : stanza.imageUrl 
                            ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/30'}
                `}
            >
                {stanza.isLoading ? (
                    <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Painting...
                    </>
                ) : stanza.imageUrl ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Visualize
                    </>
                )}
            </button>
            
            {stanza.error && (
                <span className="text-red-400 text-xs">{stanza.error}</span>
            )}
        </div>
      </div>

      {/* Image Section */}
      <div className="md:w-1/2 bg-black min-h-[300px] relative flex items-center justify-center overflow-hidden">
        {!stanza.imageUrl && !stanza.isLoading && (
            <div className="text-slate-600 flex flex-col items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                <span className="text-sm uppercase tracking-widest opacity-30 font-bold">Waiting to Generate</span>
            </div>
        )}
        
        {stanza.isLoading && (
            <div className="absolute inset-0 bg-slate-900/80 z-10 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <div className="text-purple-300 text-sm animate-pulse">Dreaming...</div>
            </div>
        )}

        {stanza.imageUrl && (
            <>
                <img 
                    src={stanza.imageUrl} 
                    alt="Generated visualization" 
                    className={`w-full h-full object-cover transition-opacity duration-700 ${stanza.isLoading ? 'opacity-50' : 'opacity-100'}`}
                />
                
                {/* Download Button */}
                <button
                    onClick={handleDownload}
                    className="absolute bottom-4 right-4 p-2 bg-slate-900/60 hover:bg-purple-600 text-white rounded-full backdrop-blur-md transition-all z-20 shadow-lg border border-white/10"
                    title="Download Image"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
            </>
        )}
      </div>
    </div>
  );
};

export default StanzaCard;
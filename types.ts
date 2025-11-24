export interface ArtStyle {
  id: string;
  name: string;
  promptModifier: string;
  previewColor: string;
}

export interface Stanza {
  id: string;
  text: string;
  imageUrl?: string;
  isLoading: boolean;
  error?: string;
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    promptModifier: 'Cinematic film still, 4k, highly detailed, dramatic lighting, photorealistic, movie scene',
    previewColor: 'from-blue-600 to-purple-600'
  },
  {
    id: 'anime',
    name: 'Anime/Manga',
    promptModifier: 'Anime style, Studio Ghibli inspired, vibrant colors, detailed background, 2D animation',
    previewColor: 'from-pink-500 to-rose-500'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    promptModifier: 'Cyberpunk aesthetic, neon lights, futuristic city, high tech low life, synthwave colors',
    previewColor: 'from-cyan-500 to-fuchsia-500'
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    promptModifier: 'Soft watercolor painting, artistic, fluid strokes, pastel colors, dreamy atmosphere',
    previewColor: 'from-emerald-400 to-teal-400'
  },
  {
    id: 'noir',
    name: 'Film Noir',
    promptModifier: 'Black and white photography, film noir, high contrast, shadows, mysterious, vintage',
    previewColor: 'from-gray-600 to-gray-900'
  },
  {
    id: 'surreal',
    name: 'Surrealist',
    promptModifier: 'Surrealist art, Salvador Dali style, dreamlike, melting objects, abstract concepts, weird',
    previewColor: 'from-orange-500 to-amber-500'
  },
  {
    id: 'custom',
    name: 'Custom',
    promptModifier: 'Custom art style defined by user',
    previewColor: 'from-indigo-500 to-violet-500'
  }
];
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateStanzaImage = async (
  lyrics: string,
  stylePrompt: string,
  contextPrompt: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  // Construct a prompt that enforces consistency and visualizes the lyrics
  const fullPrompt = `
    Create an image based on the following art style: ${stylePrompt}.
    
    Context/Theme of the entire song: ${contextPrompt || 'Open interpretation'}.
    
    Specific Scene Description based on these lyrics: "${lyrics}".
    
    Ensure the image visualizes the lyrics metaphorically or literally, fitting the requested style.
    High quality, detailed.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: fullPrompt }
        ]
      }
    });

    // Iterate through parts to find the image
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${base64Data}`;
        }
      }
    }

    throw new Error("No image data found in response.");
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "Failed to generate image.");
  }
};
import { GoogleGenAI } from "@google/genai";

export const generateStanzaImage = async (
  lyrics: string,
  stylePrompt: string,
  contextPrompt: string,
  modelId: string
): Promise<string> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API Key is missing. Please select an API Key.");
  }

  // Create a new instance for each request to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey });

  // Construct a prompt that enforces consistency and visualizes the lyrics
  const fullPrompt = `
    Create an image based on the following art style: ${stylePrompt}.
    
    Context/Theme of the entire song: ${contextPrompt || 'Open interpretation'}.
    
    Specific Scene Description based on these lyrics: "${lyrics}".
    
    Ensure the image visualizes the lyrics metaphorically or literally, fitting the requested style.
    High quality, detailed.
  `;

  // Configure image options based on the model
  const imageConfig: any = {
      aspectRatio: '1:1'
  };

  // 'imageSize' is only supported by gemini-3-pro-image-preview
  if (modelId === 'gemini-3-pro-image-preview') {
      imageConfig.imageSize = '1K';
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { text: fullPrompt }
        ]
      },
      config: {
        imageConfig
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
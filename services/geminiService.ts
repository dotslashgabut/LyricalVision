import { GoogleGenAI } from "@google/genai";

export const generateStanzaImage = async (
  lyrics: string,
  stylePrompt: string,
  contextPrompt: string,
  subjectPrompt: string,
  modelId: string,
  aspectRatio: string,
  referenceImages?: { data: string; mimeType: string }[]
): Promise<string> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API Key is missing. Please select an API Key.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Base prompt instructions
  const textPrompt = `
    ART STYLE: ${stylePrompt}
    GLOBAL THEME/ENVIRONMENT: ${contextPrompt || 'Consistent aesthetic'}
    MAIN CHARACTER/SUBJECT: ${subjectPrompt || 'Consistent with previous scenes'}
    
    CURRENT SCENE LYRICS: "${lyrics}"
    
    INSTRUCTIONS:
    1. Create a visual representation of the provided lyrics.
    ${referenceImages && referenceImages.length > 0 ? `2. USE THE ATTACHED ${referenceImages.length} REFERENCE IMAGES as the primary sources for character design, clothing, environment details, and visual style. Synthesize elements from these images.` : "2. Maintain visual continuity with the main subject and theme."}
    3. Use a consistent color palette and lighting style.
    4. Ensure this image feels like part of a coherent visual series.
    5. High quality, stylistic, and evocative.
  `;

  const imageConfig: any = {
      aspectRatio: aspectRatio
  };

  if (modelId === 'gemini-3-pro-image-preview') {
      imageConfig.imageSize = '1K';
  }

  const parts: any[] = [];
  
  // Add reference images if provided
  if (referenceImages && referenceImages.length > 0) {
    referenceImages.forEach(img => {
      parts.push({
        inlineData: {
          data: img.data,
          mimeType: img.mimeType
        }
      });
    });
  }

  // Add the text prompt at the end
  parts.push({ text: textPrompt });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: { imageConfig }
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const resultParts = candidates[0].content.parts;
      for (const part of resultParts) {
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
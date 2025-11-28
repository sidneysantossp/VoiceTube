import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Helper for exponential backoff delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface GenerateOptions {
  apiKey: string;
  model: string;
  contents: any[];
  config?: any;
}

/**
 * Wrapper for Gemini API calls that handles "429 Too Many Requests" errors
 * by automatically retrying with exponential backoff.
 * Essential for the Free Tier limits (15 RPM).
 */
export async function generateContentWithRetry(options: GenerateOptions, retries = 3): Promise<GenerateContentResponse> {
  const { apiKey, model, contents, config } = options;
  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Direct call to the SDK
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      return response;

    } catch (error: any) {
      // Check for Rate Limit (429) or Service Unavailable (503)
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      const isOverloaded = error.message?.includes('503') || error.status === 503;

      if ((isRateLimit || isOverloaded) && attempt < retries) {
        // Wait: 2s, 4s, 8s...
        const delay = 2000 * Math.pow(2, attempt);
        console.warn(`Gemini API busy (Attempt ${attempt + 1}/${retries}). Retrying in ${delay}ms...`);
        await wait(delay);
        continue;
      }

      // If it's not a retryable error or we ran out of retries, throw it
      throw error;
    }
  }

  throw new Error("Failed to generate content after retries");
}
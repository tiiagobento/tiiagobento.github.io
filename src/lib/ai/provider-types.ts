export type AIProviderName = "gemini" | "groq" | "openrouter" | "huggingface" | "mock";
export type AITask = "extract-leads" | "generate-message";

export type AIImageInput = {
  mimeType: string;
  data: string;
};

export type AIProviderRequest = {
  task: AITask;
  prompt: string;
  images: AIImageInput[];
};

export type AIProvider = {
  name: AIProviderName;
  supportsImages: boolean;
  generate(input: AIProviderRequest): Promise<string>;
};

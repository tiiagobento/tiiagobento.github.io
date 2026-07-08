export {};

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          prompt: string,
          imageOrOptions?: string | { model?: string },
          options?: {
            model?: string;
          },
        ) => Promise<unknown>;
      };
      print?: (value: unknown) => void;
    };
  }
}

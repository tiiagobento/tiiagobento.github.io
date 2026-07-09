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
      auth?: {
        isSignedIn?: () => boolean;
        signIn?: (options?: { attempt_temp_user_creation?: boolean }) => Promise<unknown>;
      };
      print?: (value: unknown) => void;
    };
  }
}

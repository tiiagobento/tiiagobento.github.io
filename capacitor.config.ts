import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.novaforma.crm",
  appName: "Nova Forma CRM",
  webDir: "public",
  server: {
    url: "https://nova-forma-crm.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    App: {},
    Browser: {},
    Network: {},
  },
};

export default config;

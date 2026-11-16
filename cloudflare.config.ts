import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "ncrontab-tester",
    compatibilityDate: "2026-11-15",
    domains: ["ncrontab.swimburger.net"],
    assets: {
      notFoundHandling: "single-page-application",
    },
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: {
        enabled: true,
        headSamplingRate: 1,
      },
      traces: {
        enabled: true,
        headSamplingRate: 0.01,
      },
    },
  },
});

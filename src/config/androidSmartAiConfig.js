export const ANDROID_SMART_AI = Object.freeze({
  appName: "StationMitra",
  productName: "StationMitra Android + Smart AI",
  buildDate: "2026-09-20",
  mode: "isolated-development",
  ai: {
    enabled: true,
    readOnlyByDefault: true,
    allowedActions: ["summarize", "explain", "detect", "compare", "forecast"]
  },
  mobile: {
    bottomNavigation: ["Home", "Sales", "Stock", "Parties", "Reports"],
    quickActions: ["New Sale", "Credit Sale", "Payment", "Dip", "Expense"]
  },
  commercialPlans: ["Trial", "Starter", "Business", "Professional", "Multi-Pump", "Enterprise"]
});

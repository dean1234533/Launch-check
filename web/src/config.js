// The values people will most often want to change. Keep the numbers in step with the server's env vars.
export const config = {
  // Chrome Web Store link. Leave empty until the extension is published; the button then shows "Coming soon".
  storeUrl: "",
  // Shown in the privacy policy. Set this before you publish it.
  contactEmail: "",
  repoUrl: "https://github.com/dean1234533/Launch-check",
  lastUpdated: "29 September 2026",
  plans: {
    free: { price: "£0", scans: 3, fixes: 2 },
    pro: { price: "£10", period: "month", scans: 10, fixes: 25 },
  },
  // One-time credit packs. An AI scan costs 5 credits and a fix costs 2.
  packs: [
    { credits: 25, price: "£7" },
    { credits: 60, price: "£15" },
    { credits: 150, price: "£30" },
  ],
};

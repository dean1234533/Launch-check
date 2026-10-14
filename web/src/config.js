// The values people will most often want to change. Keep the numbers in step with the server's env vars.
export const config = {
  // Chrome Web Store link. Leave empty until the extension is published; the button then shows "Coming soon".
  // Once approved: https://chromewebstore.google.com/detail/goimgdjenphgchhcbgjafdbimjogafad
  storeUrl: "https://chromewebstore.google.com/detail/goimgdjenphgchhcbgjafdbimjogafad",
  // Shown in the privacy policy. Set this before you publish it.
  contactEmail: "dean@dean-da-dev.co.uk",
  repoUrl: "https://github.com/dean1234533/Launch-check",
  lastUpdated: "29 September 2026",
  plans: {
    free: { price: "£0", scans: 3, fixes: 2 },
    pro: { price: "£10", period: "month", scans: 10, fixes: 10 },
  },
  // What one AI scan and one fix cost in credits (CREDITS_PER_SCAN / CREDITS_PER_FIX on the server).
  credits: { scan: 3, fix: 5 },
  // One-time credit packs.
  packs: [
    { credits: 25, price: "£7" },
    { credits: 60, price: "£15" },
    { credits: 150, price: "£30" },
  ],
};

export const consumerViewports = [
  { name: 'compact', width: 320, height: 640 },
  { name: 'medium', width: 768, height: 720 },
  { name: 'wide', width: 1280, height: 800 },
];

export default { timeout: 30_000, use: { headless: true } };

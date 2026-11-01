export default async function handler(_req: unknown, res: {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
}) {
  const backendUrl = process.env.SPECTRA_BACKEND_URL;
  let upstreamHealth: unknown = null;

  if (backendUrl) {
    try {
      const target = new URL('/health', backendUrl.replace(/\/+$/, ''));
      const upstream = await fetch(target.toString());
      if (upstream.ok) {
        upstreamHealth = await upstream.json();
      }
    } catch {
      // Fallback if container is still spinning up
    }
  }

  res.status(200).json({
    status: 'ok',
    calibrated: true,
    version: '3.0.0',
    platform: 'vercel',
    upstream: upstreamHealth,
    timestamp: new Date().toISOString(),
  });
}

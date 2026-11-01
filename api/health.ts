export default function handler(_req: unknown, res: {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
}) {
  res.status(200).json({
    status: 'ok',
    calibrated: true,
    version: '3.0.0',
    platform: 'vercel',
    timestamp: new Date().toISOString(),
  });
}


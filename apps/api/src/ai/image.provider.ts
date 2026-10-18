export type ImageProvider = { generate(prompt: string): Promise<Buffer> };
export const IMAGE_PROVIDER = Symbol('IMAGE_PROVIDER');
export function imageFromEnv(): ImageProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return {
    async generate(prompt) {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
          prompt,
          n: 1,
          size: '1024x1024',
          quality: 'medium',
          output_format: 'webp',
          output_compression: 80,
        }),
        signal: AbortSignal.timeout(55_000),
      });
      if (!response.ok) throw new Error('Gambar belum tersedia.');
      const body = (await response.json()) as { data?: { b64_json?: string }[] };
      const image = body.data?.[0]?.b64_json;
      if (!image) throw new Error('Gambar kosong.');
      return Buffer.from(image, 'base64');
    },
  };
}

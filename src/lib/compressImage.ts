/**
 * 업로드 전 이미지 축소·WebP 변환 (긴 변 1600px, 품질 0.8).
 * 브라우저가 지원하지 않거나 실패하면 원본 파일을 그대로 돌려준다.
 */
const MAX_EDGE = 1600;

export async function compressImage(file: File): Promise<{ blob: Blob; extension: string; contentType: string }> {
  const original = {
    blob: file as Blob,
    extension: (file.name.split('.').pop() || 'jpg').toLowerCase(),
    contentType: file.type || 'image/jpeg',
  };
  if (typeof createImageBitmap !== 'function' || file.type === 'image/gif') return original;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest > MAX_EDGE) {
      const scale = MAX_EDGE / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return original;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/webp', 0.8));
    // Safari 구버전 등 WebP 인코딩 미지원 시 png 로 떨어지므로 타입 확인
    if (!blob || blob.size === 0 || blob.type !== 'image/webp' || blob.size >= file.size) return original;
    return { blob, extension: 'webp', contentType: 'image/webp' };
  } catch {
    return original;
  }
}

export async function compressImage(file: File): Promise<File> {
  // 如果不是圖片，直接回傳
  if (!file.type.startsWith('image/')) return file;

  const img = document.createElement('img');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });

  const MAX_SIZE = 1024; // 最大邊 1024px
  let { width, height } = img;

  if (width > height && width > MAX_SIZE) {
    height = Math.round((height * MAX_SIZE) / width);
    width = MAX_SIZE;
  } else if (height > MAX_SIZE) {
    width = Math.round((width * MAX_SIZE) / height);
    height = MAX_SIZE;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b!),
      'image/jpeg', // 🔥 強制轉 JPEG
      0.8           // 🔥 壓縮品質（0.7～0.85 都 OK）
    );
  });

  URL.revokeObjectURL(objectUrl);

  return new File([blob], 'avatar.jpg', {
    type: 'image/jpeg',
  });
}

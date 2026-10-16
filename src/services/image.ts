/** 照片在简历中的输出尺寸（3:4 证件照比例） */
const OUTPUT_WIDTH = 300;
const OUTPUT_HEIGHT = 400;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const AVATAR_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

type Translate = (key: string) => string;

function loadImage(url: string, t: Translate): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t('photo.read')));
    img.src = url;
  });
}

/**
 * 将用户选择的图片居中裁剪为 3:4，缩放到 300×400 并压缩为 JPEG data URL。
 * 结果体积较小，可直接存入本地数据与 JSON 备份。
 */
export async function fileToAvatar(file: File, t: Translate): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(t('photo.type'));
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(t('photo.size'));
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl, t);
    const targetRatio = OUTPUT_WIDTH / OUTPUT_HEIGHT;
    const sourceRatio = img.naturalWidth / img.naturalHeight;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (sourceRatio > targetRatio) {
      sw = img.naturalHeight * targetRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetRatio;
      sy = (img.naturalHeight - sh) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('photo.canvas'));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses an image file client-side using an offscreen HTML5 canvas.
 * Reduces raw camera / PNG photos down to an optimized JPEG thumbnail (max 256x256, ~15-25 KB).
 * @param {File} file - The uploaded image file
 * @param {number} maxDimension - Max width or height (default: 256)
 * @param {number} quality - JPEG compression quality 0.0 - 1.0 (default: 0.8)
 * @returns {Promise<string>} Resolves to a base64 data URL
 */
export function compressProfileImage(file, maxDimension = 256, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}


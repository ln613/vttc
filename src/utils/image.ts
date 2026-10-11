// Shrink a picked image to fit within `maxSize` pixels and return it as a
// JPEG data URL, small enough to store with the record it belongs to (a
// gift's photo). Anything that isn't an image the browser can read rejects.
export const shrinkImage = async (
  file: File,
  maxSize = 800,
  quality = 0.82,
): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('Not an image')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas not available')
  // JPEG has no transparency: a transparent PNG would turn black.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

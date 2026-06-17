import { supabase } from './supabase'

const BUCKET = 'plant-photos'
const MAX_WIDTH = 1280
const JPEG_QUALITY = 0.82

/**
 * Komprimerer et bilde i nettleseren til maks 1280 px bredde (JPEG) for å
 * spare lagring og redusere token-kostnad ved AI-diagnose (se SPEC 7.2).
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kunne ikke lese bildet')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Kunne ikke komprimere bildet'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

/**
 * Komprimerer og laster opp et plantebilde. Filstien starter alltid med
 * household_id slik at Storage-RLS holder husstandene adskilt.
 * Returnerer en offentlig URL som lagres i plants.photo_url.
 */
export async function uploadPlantPhoto(
  householdId: string,
  file: File,
): Promise<string> {
  const blob = await compressImage(file)
  const path = `${householdId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

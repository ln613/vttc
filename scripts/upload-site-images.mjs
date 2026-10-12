#!/usr/bin/env node
// Upload a club website's images to Cloudinary and record where they went.
//
//   node scripts/with-club.mjs --club timingsports \
//     node scripts/upload-site-images.mjs <images dir> [--folder "Timing Sports"]
//     [--no-manifest]
//
// Every image in <images dir> is uploaded to the folder (overwriting one of
// the same name), and clubs/<club>/site/images.json maps each file's name
// ("hero-1") to its address, served in the best format and quality for the
// browser (f_auto,q_auto). The site reads that file (src/site/siteContent.ts),
// so the images are not bundled into the app. With --no-manifest the
// addresses are only printed — for images a club's config points at
// directly (a logo, a banner background) rather than its website's.
// Videos (.mp4, .webm) go up the same way, as Cloudinary videos.
//
// Needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { extname, basename, join } from 'node:path'

const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }
const VIDEO_TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm' }
const MEDIA_TYPES = { ...IMAGE_TYPES, ...VIDEO_TYPES }
const isVideo = (path) => !!VIDEO_TYPES[extname(path).toLowerCase()]

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const readArgs = () => {
  const args = process.argv.slice(2)
  const flag = args.indexOf('--folder')
  const folder = flag === -1 ? null : args.splice(flag, 2)[1]
  const noManifest = args.includes('--no-manifest')
  return { dir: args.filter((a) => a !== '--no-manifest')[0], folder, noManifest }
}

const readEnv = () => {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret, CLUB: club } = process.env
  if (!cloud || !key || !secret) fail('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET')
  if (!club) fail('Run through scripts/with-club.mjs --club <club>')
  return { cloud, key, secret, club }
}

const imagesIn = (dir) => {
  if (!dir || !existsSync(dir)) fail(`No images folder: ${dir}`)
  return readdirSync(dir).filter((f) => MEDIA_TYPES[extname(f).toLowerCase()]).sort()
}

// Cloudinary's signed upload: the parameters sorted, joined, and hashed with
// the secret appended.
const sign = (params, secret) =>
  createHash('sha1')
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&') + secret,
    )
    .digest('hex')

const upload = async ({ cloud, key, secret }, folder, path) => {
  const params = {
    folder,
    public_id: basename(path, extname(path)),
    overwrite: 'true',
    timestamp: String(Math.floor(Date.now() / 1000)),
  }
  const form = new FormData()
  for (const [k, v] of Object.entries(params)) form.append(k, v)
  form.append('api_key', key)
  form.append('signature', sign(params, secret))
  form.append('file', new Blob([readFileSync(path)], { type: MEDIA_TYPES[extname(path).toLowerCase()] }), basename(path))
  const kind = isVideo(path) ? 'video' : 'image'
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`, { method: 'POST', body: form })
  const body = await res.json()
  if (!res.ok) throw new Error(`${basename(path)}: ${body?.error?.message || res.status}`)
  return body.secure_url
}

// Let Cloudinary pick the format (WebP/AVIF where the browser takes it) and
// the compression.
const optimised = (url) => url.replace(/\/(image|video)\/upload\//, '/$1/upload/f_auto,q_auto/')

const main = async () => {
  const env = readEnv()
  const { dir, folder: folderArg, noManifest } = readArgs()
  const configPath = `clubs/${env.club}/config.json`
  const folder = folderArg || JSON.parse(readFileSync(configPath, 'utf8')).name
  const manifestPath = `clubs/${env.club}/site/images.json`
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}

  for (const file of imagesIn(dir)) {
    const url = optimised(await upload(env, folder, join(dir, file)))
    manifest[basename(file, extname(file))] = url
    console.log(noManifest ? `${file}: ${url}` : `uploaded ${file}`)
  }
  if (noManifest) return
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`${Object.keys(sorted).length} images in ${manifestPath} (folder "${folder}")`)
}

main().catch((err) => fail(err.message))

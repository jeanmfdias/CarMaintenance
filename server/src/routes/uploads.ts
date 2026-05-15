import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { config } from '../config.js'
import { authMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { notFound, forbidden, badRequest } from '../lib/errors.js'

const router = Router()
router.use(authMiddleware)

// UUID userId, plus a strict filename pattern: <uuid>.(jpg|jpeg|png|webp)
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i

router.get(
  '/:userId/:filename',
  asyncHandler(async (req, res) => {
    if (req.params.userId !== req.user!.id) throw forbidden()
    // Strip any directory components defensively before regex check.
    const candidate = path.basename(req.params.filename)
    if (!SAFE_FILENAME.test(candidate)) throw badRequest('Invalid filename')

    const userDir = path.resolve(path.join(config.uploadsDir, req.user!.id))
    const fullPath = path.resolve(path.join(userDir, candidate))
    // Defense-in-depth: resolved path must remain inside userDir.
    if (!fullPath.startsWith(userDir + path.sep)) throw forbidden()
    if (!fs.existsSync(fullPath)) throw notFound()
    res.sendFile(fullPath)
  })
)

export default router

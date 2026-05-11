import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { config } from '../config.js'
import { authMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { notFound, forbidden } from '../lib/errors.js'

const router = Router()
router.use(authMiddleware)

router.get(
  '/:userId/:filename',
  asyncHandler(async (req, res) => {
    if (req.params.userId !== req.user!.id) throw forbidden()
    const safeName = path.basename(req.params.filename) // prevent traversal
    const fullPath = path.join(config.uploadsDir, req.user!.id, safeName)
    if (!fs.existsSync(fullPath)) throw notFound()
    res.sendFile(fullPath)
  })
)

export default router

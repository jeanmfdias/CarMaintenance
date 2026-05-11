import jwt, { type SignOptions } from 'jsonwebtoken'
import { config } from '../config.js'

export interface JwtPayload {
  sub: string // user id
  email: string
  sid?: string // session id (for revocation)
}

export function signJwt(payload: JwtPayload): string {
  const opts: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] }
  return jwt.sign(payload, config.jwtSecret, opts)
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload
}

import jwt, { type SignOptions, type VerifyOptions, type Algorithm } from 'jsonwebtoken'
import { config } from '../config.js'

export interface JwtPayload {
  sub: string // user id
  email: string
  sid?: string // session id (for revocation)
}

const ALG: Algorithm = 'HS256'

export function signJwt(payload: JwtPayload): string {
  const opts: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    algorithm: ALG,
  }
  return jwt.sign(payload, config.jwtSecret, opts)
}

export function verifyJwt(token: string): JwtPayload {
  // Pin algorithm — defends against `alg: none` and HS/RS confusion attacks.
  const opts: VerifyOptions = { algorithms: [ALG] }
  return jwt.verify(token, config.jwtSecret, opts) as JwtPayload
}

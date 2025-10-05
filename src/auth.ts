import { hash, compare } from 'bcrypt-ts';
import { SignJWT, jwtVerify } from 'jose';

async function getJwtSecret(env) {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set!');
    }
    return new TextEncoder().encode(env.JWT_SECRET);
}

// Function to get user from a request
export async function getUserFromRequest(request, env) {
    const cookie = request.headers.get('Cookie');
    if (!cookie) return null;

    const match = cookie.match(/auth_token=([^;]+)/);
    if (!match) return null;

    const token = match[1];
    try {
        const secret = await getJwtSecret(env);
        const { payload } = await jwtVerify(token, secret);
        if (payload.sub) {
            const user = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(payload.sub).first();
            return user;
        }
    } catch (err) {
        // Invalid token or secret issue
        console.error("JWT verification failed:", err);
        return null;
    }
    return null;
}

// Function to create a JWT for a user
export async function createJwt(userId, env) {
    const secret = await getJwtSecret(env);
    return await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
}

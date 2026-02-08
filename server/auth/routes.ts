import { Express, Request, Response } from 'express';
import passport from './google-oauth';
import { generateToken, generateSessionId } from './jwt';
import { createSession } from './db-helpers';

export function registerAuthRoutes(app: Express) {
  // Initialize passport
  app.use(passport.initialize());
  
  // Google OAuth - Initiate
  app.get(
    '/api/auth/google',
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
    })
  );
  
  // Google OAuth - Callback
  app.get(
    '/api/auth/google/callback',
    passport.authenticate('google', {
      session: false,
      failureRedirect: '/login?error=google_auth_failed',
    }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        
        if (!user) {
          return res.redirect('/login?error=no_user');
        }
        
        // Create session
        const sessionId = generateSessionId();
        const token = generateToken(user.id, sessionId);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        
        await createSession({
          userId: user.id,
          token,
          expiresAt,
        });
        
        console.log(`[Auth] Google OAuth successful for user ${user.email}`);
        
        // Redirect to frontend with token
        res.redirect(`/auth/callback?token=${token}`);
      } catch (error) {
        console.error('[Auth] Google OAuth callback error:', error);
        res.redirect('/login?error=callback_failed');
      }
    }
  );
  
  console.log('[Auth] Google OAuth routes registered');
}

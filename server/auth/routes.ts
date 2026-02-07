import { Router } from 'express';
import passport from './google-oauth';
import { generateToken } from './jwt';
import { saveSession } from './db-helpers';

const router = Router();

// Google OAuth login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_auth_failed' }),
  async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect('/login?error=no_user');
      }
      
      // Generate JWT token
      const { token, sessionId } = generateToken(user.id, user.email);
      
      // Save session to database
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await saveSession(sessionId, user.id, token, expiresAt);
      
      // Redirect to frontend with token
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      res.redirect(`${appUrl}/auth/callback?token=${token}` );
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect('/login?error=callback_failed');
    }
  }
);

export default router;

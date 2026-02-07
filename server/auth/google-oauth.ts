import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findUserByGoogleId, findUserByEmail, createUser, User } from './db-helpers';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET ) {
  console.warn('⚠️  Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }
        
        // Check if user exists by Google ID
        let user = await findUserByGoogleId(googleId);
        
        if (!user) {
          // Check if user exists by email
          user = await findUserByEmail(email);
          
          if (user) {
            // Update existing user with Google ID
            // Note: You'll need to add an updateUser function to db-helpers.ts if you want this
            // For now, we'll just use the existing user
          } else {
            // Create new user
            user = await createUser(email, name, googleId);
          }
        }
        
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser((id: number, done) => {
  // This is not used in our JWT-based auth, but required by passport
  done(null, { id });
});

export default passport;

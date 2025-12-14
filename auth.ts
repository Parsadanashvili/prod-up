import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createUser, getUserByEmail } from '@/lib/db/queries';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        // For MVP, we'll create/get user by email
        // In production, you'd verify password here
        const user = await getUserByEmail(credentials.email as string);
        
        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        }

        // Create new user if doesn't exist (for MVP simplicity)
        const newUser = await createUser({
          id: crypto.randomUUID(),
          email: credentials.email as string,
          name: null,
          image: null,
        });

        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          image: newUser.image,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
});


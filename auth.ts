import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/db";
import { normalizePhone, verifyPassword } from "@/lib/auth/password";

const credentialsSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string | null;
      name: string;
      avatarUrl?: string | null;
    };
  }
  interface User {
    id?: string;
    phone?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }
}


export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "phone-password",
      credentials: {
        phone: { label: "手机号", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const phone = normalizePhone(parsed.data.phone);
        if (!phone) return null;

        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          phone: user.phone,
          name: user.name,
          avatarUrl: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.phone = user.phone ?? null;
        token.name = user.name ?? "";
        token.avatarUrl = user.avatarUrl ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: String(token.uid ?? ""),
        phone: (token.phone as string | null) ?? null,
        name: (token.name as string) ?? "",
        avatarUrl: (token.avatarUrl as string | null) ?? null,
      };
      return session;
    },
  },
});

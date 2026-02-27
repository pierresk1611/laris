import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Laris Automat",
            credentials: {
                email: { label: "Email / Meno", type: "text" },
                password: { label: "Heslo", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Chýbajúce prihlasovacie údaje");
                }

                // 2. Master Účet (Hardcoded Backdoor)
                // In production, define an env like MASTER_LOGIN and MASTER_PASSWORD if needed
                if (credentials.email === "admin" && credentials.password === "admin") {
                    return {
                        id: "super_admin_backdoor",
                        name: "Super Admin",
                        email: "admin",
                        role: "SUPER_ADMIN"
                    };
                }

                // Normálne prihlásenie užívateľa cez DB
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                });

                if (!user || !user.isActive) {
                    throw new Error("Neplatné údaje alebo neaktívny účet");
                }

                const isValid = await bcrypt.compare(credentials.password, user.password);
                if (!isValid) {
                    throw new Error("Nesprávne heslo");
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
            }
            return session;
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET || "super-secret-laris-key-default",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: "/login",
    },
});

export const config = {
    matcher: [
        /*
         * Chránime všetky cesty okrem:
         * - /api/auth (NextAuth)
         * - /api/agent (Public endpoints pre agenta)
         * - /api/dropbox (Webhooks pre Dropbox)
         * - /login (Prihlasovacia obrazovka)
         * - /_next (Statické assety a image cesty)
         * - *.png, *.svg, *.jpg atď.
         */
        "/((?!api/auth|api/agent|api/dropbox|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};

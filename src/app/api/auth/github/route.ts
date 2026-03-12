// /app/api/auth/github/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createJWT } from "@/lib/jwt";
import { GithubUser } from "@/types/gh_user";

const {
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_REDIRECT_URL,
    NEXT_PUBLIC_APP_URL,
    NODE_ENV,
} = process.env;

const isProduction = NODE_ENV === "production";
const APP_URL = NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function mustGetEnv(name: string, value?: string): string {
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

function randomState() {
    return crypto.randomBytes(16).toString("hex");
}

async function exchangeCodeForToken(code: string): Promise<string> {
    const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "nextjs-github-oauth",
        },
        body: JSON.stringify({
            client_id: mustGetEnv("GITHUB_CLIENT_ID", GITHUB_CLIENT_ID),
            client_secret: mustGetEnv("GITHUB_CLIENT_SECRET", GITHUB_CLIENT_SECRET),
            code,
            redirect_uri: mustGetEnv("GITHUB_REDIRECT_URL", GITHUB_REDIRECT_URL),
        }),
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);

    return data.access_token as string;
}

async function fetchGitHubUser(accessToken: string): Promise<GithubUser> {
    const headers = {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "nextjs-github-oauth",
    };

    const res = await fetch("https://api.github.com/user", { headers });
    if (!res.ok) throw new Error(`GitHub /user failed: ${res.status}`);
    return res.json();
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "login";

    // ── Step 1: Redirect to GitHub ────────────────────────────────────────────
    if (action === "login") {
        const state = randomState();
        const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
        authorizeUrl.searchParams.set("client_id", mustGetEnv("GITHUB_CLIENT_ID", GITHUB_CLIENT_ID));
        authorizeUrl.searchParams.set("redirect_uri", mustGetEnv("GITHUB_REDIRECT_URL", GITHUB_REDIRECT_URL));
        authorizeUrl.searchParams.set("scope", "read:user user:email");
        authorizeUrl.searchParams.set("state", state);

        const res = NextResponse.redirect(authorizeUrl.toString());
        res.cookies.set("oauth_state", state, {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction,
            path: "/",
            maxAge: 10 * 60,
        });

        return res;
    }

    // ── Step 2: OAuth callback ────────────────────────────────────────────────
    if (action === "callback") {
        const installationId = url.searchParams.get("installation_id");

        // GitHub App install flow
        if (installationId) {
            const res = NextResponse.redirect(`${APP_URL}/`);
            res.cookies.set("github_installation_id", installationId, {
                httpOnly: true,
                sameSite: "lax",
                secure: isProduction,
                path: "/",
                maxAge: 60 * 60 * 24 * 7,
            });
            return res;
        }

        // OAuth login flow
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const expectedState = req.cookies.get("oauth_state")?.value;

        if (!code || !state || state !== expectedState) {
            return NextResponse.redirect(`${APP_URL}/auth?error=state_mismatch`);
        }

        try {
            const accessToken = await exchangeCodeForToken(code);
            const githubUser = await fetchGitHubUser(accessToken);

            console.log(githubUser);

            const sessionJWT = createJWT({
                github_id: githubUser.id,
                login: githubUser.login,
                name: githubUser.name,
                email: githubUser.email,
                avatar_url: githubUser.avatar_url,
            });

            const res = NextResponse.redirect(`${APP_URL}/`);
            res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
            res.cookies.set("session", sessionJWT, {
                httpOnly: true,
                sameSite: "lax",
                secure: isProduction,
                path: "/",
                maxAge: 60 * 60 * 24 * 7,
            });

            return res;
        } catch (err) {
            console.error("GitHub OAuth callback error:", err);
            return NextResponse.redirect(`${APP_URL}/auth?error=oauth_failed`);
        }
    }

    return NextResponse.redirect(`${APP_URL}/auth?error=invalid_action`);
}

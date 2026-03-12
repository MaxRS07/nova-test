import { redirect } from 'next/navigation';

// Redirect /login → /auth, forwarding any query params (e.g. ?error=...)
export default function LoginRedirect({
    searchParams,
}: {
    searchParams: Record<string, string>;
}) {
    const params = new URLSearchParams(searchParams).toString();
    redirect(`/auth${params ? `?${params}` : ''}`);
}

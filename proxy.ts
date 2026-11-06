import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function loginRedirect(request: NextRequest, refreshed?: NextResponse) {
  const redirect = NextResponse.redirect(new URL("/login", request.url));
  refreshed?.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Public authentication screens render without waiting for a session refresh.
  if (["/login", "/forgot-password", "/reset-password", "/auth/recovery"].includes(pathname)) {
    return NextResponse.next({ request });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return pathname === "/" ? loginRedirect(request) : NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (pathname === "/" && (error || !data?.claims?.sub)) return loginRedirect(request, response);
  } catch {
    if (pathname === "/") return loginRedirect(request, response);
  }
  if (pathname === "/") response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

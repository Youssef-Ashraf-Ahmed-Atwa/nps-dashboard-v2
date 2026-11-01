import { NextResponse, type NextRequest } from "next/server";

/**
 * Password for the whole site (pages and API), using the browser's built-in
 * login box. Set APP_PASSWORD in the environment (any user name works).
 * - Not set while developing: the site is open.
 * - Not set in production: the site refuses to open, so it can never go online by mistake.
 */
export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD is not set on the server.", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given.length === password.length && given === password) return NextResponse.next();
    } catch {
      /* fall through to the login box */
    }
  }

  return new NextResponse("Login required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NPS dashboard", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

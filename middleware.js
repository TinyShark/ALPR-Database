import { NextResponse } from "next/server";

console.log("middleware is identified");

export async function middleware(request) {
  // console.log("\n--- Middleware Start ---");
  // console.log("URL:", request.nextUrl.pathname);
  // console.log("Method:", request.method);
  // console.log("All Cookies:", request.cookies.getAll());
  // console.log("Session Cookie:", request.cookies.get("session"));
  // console.log("Headers:", Object.fromEntries(request.headers));

  // Allow public paths
  const publicPaths = [
    "/login",
    "/_next",
    "/favicon.ico",
    "/api/plate-reads", // API auth handled in the route itself
    "/api/verify-session",
    "/api/health-check",
    "/api/verify-key",
    "/api/known-plates",
  ];

  // Check for API key in query parameters for iframe embeds (insecure)
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get("api_key");

  if (queryApiKey) {
    try {
      const response = await fetch(new URL("/api/verify-key", request.url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: queryApiKey }),
      });

      const result = await response.json();
      if (result.valid) {
        // Create a new response that preserves the API key in all internal links
        const res = NextResponse.next();

        // Rewrite the request URL to include the API key
        const rewrittenUrl = new URL(request.url);
        if (!rewrittenUrl.searchParams.has("api_key")) {
          rewrittenUrl.searchParams.set("api_key", queryApiKey);
        }

        // Set a header that your frontend can use to maintain the API key
        res.headers.set("x-api-key", queryApiKey);

        return res;
      }
    } catch (error) {
      console.error("API key verification error:", error);
    }
  }

  if (publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))) {
    if (request.nextUrl.pathname === "/api/plates") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const apiKey = authHeader.replace("Bearer ", "");

      try {
        const response = await fetch(new URL("/api/verify-key", request.url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey }),
        });

        if (!response.ok) {
          return new Response("Invalid API Key", { status: 401 });
        }
      } catch (error) {
        console.error("Auth verification error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    return NextResponse.next();
  }

  // Check session cookie for authenticated routes
  const session = request.cookies.get("session");
  if (!session) {
    console.log("No session cookie block run");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    console.log("Verifying session", session.value);

    const response = await fetch(new URL("/api/verify-session", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: session.value,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to verify session. Status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Response JSON:", result);

    if (!result.valid) {
      console.log("Invalid session, clearing cookie");
      const res = NextResponse.redirect(new URL("/login", request.url));
      res.cookies.delete("session");
      return res;
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};

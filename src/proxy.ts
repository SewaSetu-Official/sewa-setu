import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/partner(.*)",
  "/api/partner-inquiry(.*)",
  "/search(.*)",
  "/hospital(.*)",
  "/doctor(.*)",
  "/doctor-invite(.*)",
  "/book(.*)",
  "/booking/verify(.*)",
  "/api/hospitals(.*)",
  "/api/doctor(.*)",
  "/api/specialties(.*)",
  "/api/location(.*)",
  "/api/reviews(.*)",
  "/api/availability(.*)",
  "/api/ai(.*)",
  "/api/webhooks(.*)",
  "/api/booking/verify(.*)",
]);

// Admin routes always require authentication; role checks happen inside each
// page/API via requirePlatformAdmin() or requireHospitalAccess().
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    // Must be signed in; role/hospital checks happen in the route itself.
    await auth.protect();
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

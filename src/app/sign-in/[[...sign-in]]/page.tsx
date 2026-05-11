import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-4">
      <SignIn fallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />
    </div>
  );
}

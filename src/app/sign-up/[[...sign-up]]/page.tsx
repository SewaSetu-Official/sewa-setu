import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #060d1f 0%, #0a1228 60%, #0d1a35 100%)" }}>
      <SignUp fallbackRedirectUrl="/" signInFallbackRedirectUrl="/" />
    </div>
  );
}

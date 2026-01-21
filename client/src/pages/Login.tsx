import { SignIn } from "@clerk/clerk-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <SignIn 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-2xl",
          },
        }}
        routing="path"
        path="/login"
        signUpUrl="/signup"
        afterSignInUrl="/"
        afterSignUpUrl="/"
      />
    </div>
  );
}

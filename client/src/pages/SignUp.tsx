import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <SignUp 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-2xl",
          },
        }}
        routing="path"
        path="/signup"
        signInUrl="/login"
        afterSignInUrl="/"
        afterSignUpUrl="/"
      />
    </div>
  );
}

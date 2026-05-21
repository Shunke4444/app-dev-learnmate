import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { PillButton } from "@/components/PillButton";

export default function WelcomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-6 pb-10 pt-16">
      <div className="flex flex-1 flex-col items-center">
        <div className="mt-2">
          <Mascot state="idle" size={86} />
        </div>

        <h1 className="mt-10 text-center text-2xl font-semibold tracking-tight">
          Welcome to
          <br />
          LearnMate
        </h1>
        <p className="mt-3 text-center text-sm text-muted">
          Your Personal Study Buddy
        </p>

        <div className="mt-12 flex w-full flex-col gap-4">
          <Link href="/login" className="w-full">
            <PillButton variant="surface">Log in</PillButton>
          </Link>
          <Link href="/login" className="w-full">
            <PillButton variant="surface">Sign up</PillButton>
          </Link>
        </div>

        <div className="mt-10 w-full">
          <p className="text-center text-xs tracking-wide text-muted">
            Continue With Accounts
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <PillButton variant="google">Google</PillButton>
            <PillButton variant="facebook">Facebook</PillButton>
          </div>
        </div>
      </div>
    </div>
  );
}

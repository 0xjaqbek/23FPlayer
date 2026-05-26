import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DjProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.djProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <main>
      <DjProfileForm profile={profile} />
    </main>
  );
}

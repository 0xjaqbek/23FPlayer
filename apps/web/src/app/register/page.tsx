import { cookies } from "next/headers";
import { hasValidRegistrationGateCookie, registrationGateCookieName } from "@/features/auth/server/registration-gate-cookie";
import { AccountRegistrationForm, RegistrationGateForm } from "./register-forms";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const gatePassed = hasValidRegistrationGateCookie(cookieStore.get(registrationGateCookieName)?.value);

  return <main>{gatePassed ? <AccountRegistrationForm /> : <RegistrationGateForm />}</main>;
}

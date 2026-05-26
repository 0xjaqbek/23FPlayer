import { cookies } from "next/headers";
import { AccountRegistrationForm, RegistrationGateForm } from "./register-forms";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const gatePassed = cookieStore.get("registration_gate_passed")?.value === "true";

  return <main>{gatePassed ? <AccountRegistrationForm /> : <RegistrationGateForm />}</main>;
}

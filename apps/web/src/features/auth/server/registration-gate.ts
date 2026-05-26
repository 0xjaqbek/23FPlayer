type ValidateRegistrationAccessPasswordInput = {
  submittedPassword: string;
  configuredPassword: string | undefined;
};

export function validateRegistrationAccessPassword(input: ValidateRegistrationAccessPasswordInput) {
  if (!input.configuredPassword) {
    return false;
  }

  return input.submittedPassword === input.configuredPassword;
}

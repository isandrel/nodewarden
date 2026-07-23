export function shouldShowCreateAccount(registrationInviteRequired: boolean | undefined): boolean {
  return registrationInviteRequired === false;
}

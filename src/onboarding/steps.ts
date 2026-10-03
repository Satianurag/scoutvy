export function onboardingSteps(hasUsername: boolean) {
  return hasUsername ? 1 : 2;
}

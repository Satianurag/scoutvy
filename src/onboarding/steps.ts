export function onboardingSteps(hasUsername: boolean) {
  return hasUsername ? 2 : 3;
}

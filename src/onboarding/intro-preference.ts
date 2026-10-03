import AsyncStorage from "@react-native-async-storage/async-storage";

const key = "scoutvy.introduction.seen.v1";
export const hasSeenIntroduction = () => AsyncStorage.getItem(key).then(value => value === "true");
export const rememberIntroduction = () => AsyncStorage.setItem(key, "true");

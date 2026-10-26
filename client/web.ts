import { Platform } from "react-native";
// shortcut: native storage is unavailable in SDK 0.13.2; add it when a public device store exists.
declare const localStorage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
export function readDeviceValue(key: string): unknown {
  if (Platform.OS !== "web") return null;
  const stored = localStorage.getItem(`paseo-bot:${key}`);
  return stored ? JSON.parse(stored) : null;
}
export function writeDeviceValue(key: string, value: unknown): void {
  if (Platform.OS !== "web") return;
  localStorage.setItem(`paseo-bot:${key}`, JSON.stringify(value));
}

/**
 * MOCK authentication for frontend testing only — NOT real security.
 * Replace with Django auth (e.g. token/JWT) later.
 */
import { delay } from "./store";

export const DEMO_CREDENTIALS = { username: "admin", password: "admin123" };
const KEY = "dwc_session";

export const authService = {
  async login(username: string, password: string) {
    await delay(600);
    if (username.trim().toLowerCase() === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password) {
      localStorage.setItem(KEY, "demo");
      return true;
    }
    return false;
  },
  logout() {
    localStorage.removeItem(KEY);
  },
  isLoggedIn() {
    return typeof window !== "undefined" && localStorage.getItem(KEY) === "demo";
  },
};

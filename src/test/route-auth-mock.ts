export type TestRouteAuthorizationStatus = "authorized" | "unauthenticated" | "forbidden";

let currentStatus: TestRouteAuthorizationStatus = "authorized";

export function setTestRouteAuthorization(status: TestRouteAuthorizationStatus) {
  currentStatus = status;
}

export function getTestRouteAuthorization() {
  return currentStatus === "authorized"
    ? { status: "authorized" as const, userId: "user-1" }
    : { status: currentStatus };
}

export function userError(reason: unknown): string {
  if (reason && typeof reason === "object") {
    if ("userMessage" in reason && typeof reason.userMessage === "string")
      return reason.userMessage;
    if ("message" in reason && typeof reason.message === "string")
      return reason.message;
  }
  return typeof reason === "string"
    ? reason
    : "The operation could not be completed. Check the connection and try again.";
}

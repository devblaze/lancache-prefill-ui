export function getGameImageUrl(
  appId: string,
  toolDisplayName: string
): string {
  if (toolDisplayName === "Steam") {
    return `/api/images/steam/${appId}`;
  }
  return "";
}

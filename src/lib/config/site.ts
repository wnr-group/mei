export const SITE_URL = "https://couturemei.com";
export const SITE_NAME = "MEI Bridal Couture";

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}

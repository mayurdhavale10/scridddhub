import createClient from "openapi-fetch";
import type { paths } from "./types.gen";

export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type { paths, components } from "./types.gen";

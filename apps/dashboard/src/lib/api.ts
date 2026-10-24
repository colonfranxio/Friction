import { createFrictionClient, DEFAULT_API_URL } from '@friction/shared';
export const api = createFrictionClient(import.meta.env.VITE_API_URL ?? DEFAULT_API_URL);

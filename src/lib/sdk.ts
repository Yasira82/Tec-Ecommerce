import { TecSdk } from '@yasser172/tec-sdk';
import { getAccessToken, getStoredUser } from '@/lib-client/pi/pi-auth';

const gatewayUrl = process.env.API_GATEWAY_URL ?? '';

export const sdk = new TecSdk({ gatewayUrl });

const getToken = (): string | null => getAccessToken();

const getUserId = (): string | null => {
  const user = getStoredUser() as { id?: string; uid?: string } | null;
  return user?.id ?? user?.uid ?? null;
};

export { getToken, getUserId };
export default sdk;

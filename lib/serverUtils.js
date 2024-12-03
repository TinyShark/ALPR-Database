// This is a server-side utility file
import { getConfig } from './settings';

export async function getBasePath() {
  const config = await getConfig();
  return config.homeassistant?.basePath || '';
}
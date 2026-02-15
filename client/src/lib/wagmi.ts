import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonAmoy } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Polymarket Bot',
  projectId: '2daf4a63546eea39b79752d093d50b67',
  chains: [
    process.env.NODE_ENV === 'production' ? polygon : polygonAmoy
  ],
  ssr: false,
});

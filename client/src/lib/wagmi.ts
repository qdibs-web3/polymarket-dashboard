import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, polygonAmoy } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Polymarket Bot',
  projectId: '2daf4a63546eea39b79752d093d50b67',
  chains: import.meta.env.MODE === 'production'
    ? [polygon, mainnet]
    : [polygon, polygonAmoy, mainnet],
  ssr: false,
});
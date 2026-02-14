import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonMumbai } from 'wagmi/chains';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';

export const config = getDefaultConfig({
  appName: 'Polymarket Bot',
  projectId: '2daf4a63546eea39b79752d093d50b67',
  chains: [
    process.env.NODE_ENV === 'production' ? polygon : polygonMumbai
  ],
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet],
    },
  ],
  ssr: false,
});
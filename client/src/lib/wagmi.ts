import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, polygonAmoy } from 'wagmi/chains';
import { http, fallback } from 'wagmi';

/**
 * Polygon Mainnet RPC transports — listed in priority order.
 *
 * polygon-rpc.com (the RainbowKit default) now returns 401 Unauthorized
 * for unauthenticated requests, so we override it with reliable public RPCs.
 *
 * If you have an Alchemy / Infura API key, set VITE_ALCHEMY_KEY or
 * VITE_INFURA_KEY in your .env and the first transport will use it.
 * Otherwise the free public endpoints below are used as fallbacks.
 */
const alchemyKey = import.meta.env.VITE_ALCHEMY_KEY as string | undefined;
const infuraKey  = import.meta.env.VITE_INFURA_KEY  as string | undefined;

const polygonTransports = fallback([
  // Premium RPCs (only active when API keys are set)
  ...(alchemyKey ? [http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`)] : []),
  ...(infuraKey  ? [http(`https://polygon-mainnet.infura.io/v3/${infuraKey}`)]       : []),

  // Free public RPCs — CORS-friendly (browser-safe)
  // NOTE: 1rpc.io and meowrpc.com block browser CORS requests — do not add them back
  http('https://polygon-bor-rpc.publicnode.com'),   // PublicNode — fast, CORS-open
  http('https://rpc.ankr.com/polygon'),              // Ankr — reliable, CORS-open
  http('https://polygon.llamarpc.com'),              // LlamaRPC — CORS-open
  http('https://endpoints.omniatech.io/v1/matic/mainnet/public'), // Omnia — CORS-open
]);

const polygonAmoyTransports = fallback([
  http('https://rpc-amoy.polygon.technology'),
  http('https://polygon-amoy-bor-rpc.publicnode.com'),
]);

export const config = getDefaultConfig({
  appName: 'Polymarket Bot',
  projectId: '2daf4a63546eea39b79752d093d50b67',
  chains: import.meta.env.MODE === 'production'
    ? [polygon, mainnet]
    : [polygon, polygonAmoy, mainnet],
  transports: {
    [polygon.id]:      polygonTransports,
    [polygonAmoy.id]:  polygonAmoyTransports,
    [mainnet.id]:      http(),  // Use default for Ethereum mainnet
  },
  ssr: false,
});
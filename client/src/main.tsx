import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@rainbow-me/rainbowkit/styles.css';

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './lib/trpc';
import { config } from './lib/wagmi.ts';

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers() {
        return {
          'Content-Type': 'application/json',
        };
      },
      transformer: superjson,
    }),
  ],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <RainbowKitProvider modalSize="compact">
            <App />
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
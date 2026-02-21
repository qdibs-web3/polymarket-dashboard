import { useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWalletAuth } from '../hooks/useWalletAuth';

export default function Login() {
  const { 
    address,
    isConnected, 
    isAuthenticating, 
    authError, 
    authenticateWallet 
  } = useWalletAuth();

  const hasTriggered = useRef(false);
  
  // Auto-authenticate when wallet connects — only once per connection
  useEffect(() => {
    console.log('[Login] Wallet state changed', { isConnected, isAuthenticating, address });
    
    if (isConnected && address && !hasTriggered.current) {
      hasTriggered.current = true;
      console.log('[Login] Triggering authentication');
      authenticateWallet();
    }

    // Reset the ref when wallet disconnects
    if (!isConnected) {
      hasTriggered.current = false;
    }
  }, [isConnected, address]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Predicitve Apex
          </h1>
          <p className="text-gray-600">
            Connect your MetaMask wallet to continue
          </p>
        </div>
        
        <div className="flex flex-col items-center space-y-4">
          <ConnectButton />
          
          {isAuthenticating && (
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Authenticating...</span>
            </div>
           )}
          
          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg w-full">
              <p className="text-sm">{authError}</p>
            </div>
          )}
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Non-custodial trading bot</p>
          <p className="mt-1">Your keys, your funds</p>
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-gray-500 max-w-md">
        <p>
          By connecting your wallet, you agree to our Terms of Service.
          We never store your private keys.
        </p>
      </div>
    </div>
  );
}

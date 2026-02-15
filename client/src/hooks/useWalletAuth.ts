import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useLocation } from 'wouter';

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [, setLocation] = useLocation();
  
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const utils = trpc.useUtils();
  const verifyMutation = trpc.wallet.verifySignature.useMutation();
  
  const authenticateWallet = async () => {
    if (!address || !isConnected) {
      setAuthError('Wallet not connected');
      return;
    }
    
    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      // Get nonce from backend using query client
      const { nonce } = await utils.client.wallet.getNonce.query({
        walletAddress: address,
      });
      
      // Create message to sign
      const message = `Sign in to Polymarket Bot

Wallet: ${address}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This signature will not trigger any blockchain transaction or cost gas.`;
      
      // Request signature from user
      const signature = await signMessageAsync({ message });
      
      // Verify signature with backend
      const result = await verifyMutation.mutateAsync({
        walletAddress: address,
        message,
        signature,
      });
      
      if (result.success) {
        console.log('[WalletAuth] Authentication successful');
        setLocation('/dashboard');
      }
    } catch (error: any) {
      console.error('[WalletAuth] Authentication failed:', error);
      setAuthError(error.message || 'Authentication failed');
      disconnect();
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  const logout = async () => {
    disconnect();
    setLocation('/');
  };
  
  return {
    address,
    isConnected,
    isAuthenticating,
    authError,
    authenticateWallet,
    logout,
  };
}
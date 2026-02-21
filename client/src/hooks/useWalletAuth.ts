import { useAccount, useSignMessage, useDisconnect, useSwitchChain } from 'wagmi';
import { useState } from 'react';
import { polygon } from 'wagmi/chains';
import { trpc } from '../lib/trpc';
import { useLocation } from 'wouter';

export function useWalletAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
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
      // Step 1: Switch to Polygon if on wrong chain
      if (chainId !== polygon.id) {
        console.log('[WalletAuth] Wrong chain, switching to Polygon...');
        await switchChainAsync({ chainId: polygon.id });
        console.log('[WalletAuth] Switched to Polygon');
      }

      const walletAddress = address;
      
      // Step 2: Get nonce
      console.log('[WalletAuth] Getting nonce for', walletAddress);
      const { nonce } = await utils.client.wallet.getNonce.query({
        walletAddress,
      });
      console.log('[WalletAuth] Got nonce:', nonce);
      
      // Step 3: Build message
      const message = `Sign in to Polymarket Bot

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This signature will not trigger any blockchain transaction or cost gas.`;
      
      // Step 4: Request signature
      console.log('[WalletAuth] Requesting signature...');
      const signature = await signMessageAsync({ message });
      
      if (!signature) {
        throw new Error('No signature received');
      }
      
      // Step 5: Verify signature
      console.log('[WalletAuth] Verifying signature...');
      const result = await verifyMutation.mutateAsync({
        walletAddress,
        message,
        signature,
      });
      
      if (result.success && result.token) {
        console.log('[WalletAuth] Authentication successful');
        localStorage.setItem('wallet_token', result.token);
        setLocation('/dashboard');
      } else {
        throw new Error('Authentication failed - no token received');
      }
    } catch (error: any) {
      console.error('[WalletAuth] Error:', error);
      // Don't disconnect if user rejected the chain switch or signature
      if (error?.code === 4001 || error?.message?.includes('rejected')) {
        setAuthError('Request rejected. Please try again.');
      } else {
        setAuthError(error.message || 'Authentication failed');
        disconnect();
      }
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  const logout = async () => {
    localStorage.removeItem('wallet_token');
    disconnect();
    setLocation('/');
  };
  
  return {
    address,
    isConnected,
    chainId,
    isAuthenticating,
    authError,
    authenticateWallet,
    logout,
  };
}
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
      console.log('[WalletAuth] Requesting signature...');
      let signature: string | undefined;
      try {
        signature = await signMessageAsync({ message });
        console.log('[WalletAuth] Signature type:', typeof signature);
        console.log('[WalletAuth] Signature value:', signature);
        alert(`Signature received: ${signature ? 'YES' : 'NO'}\nType: ${typeof signature}\nLength: ${signature?.length || 0}`);
      } catch (signError: any) {
        console.error('[WalletAuth] Signature rejected:', signError);
        alert(`Signature ERROR: ${signError.message}`);
        throw new Error('Signature request was rejected');
      }
      
      if (!signature) {
        alert('ERROR: Signature is undefined!');
        throw new Error('No signature received from wallet');
      }
      
      console.log('[WalletAuth] Signature received, verifying...');
      alert('About to verify signature...');
      
      // Verify signature with backend
      const result = await verifyMutation.mutateAsync({
        walletAddress: address,
        message,
        signature,
      });
      
      console.log('[WalletAuth] Verification result:', result);
      alert(`Verification result: ${JSON.stringify(result)}`);
      
      if (result.success && result.token) {
        console.log('[WalletAuth] Authentication successful, storing token');
        localStorage.setItem('wallet_token', result.token);
        alert('SUCCESS! Redirecting to dashboard...');
        setLocation('/dashboard');
      } else {
        alert('ERROR: No token in response');
        throw new Error('Authentication failed - no token received');
      }
    } catch (error: any) {
      console.error('[WalletAuth] Authentication failed:', error);
      alert(`FINAL ERROR: ${error.message}`);
      setAuthError(error.message || 'Authentication failed');
      disconnect();
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
    isAuthenticating,
    authError,
    authenticateWallet,
    logout,
  };
}
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
    console.log('[WalletAuth] START - address:', address, 'isConnected:', isConnected);
    
    if (!address || !isConnected) {
      setAuthError('Wallet not connected');
      return;
    }
    
    // Capture address immediately
    const walletAddress = address;
    console.log('[WalletAuth] Captured walletAddress:', walletAddress);
    
    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      // Get nonce
      console.log('[WalletAuth] Step 1: Getting nonce for', walletAddress);
      const { nonce } = await utils.client.wallet.getNonce.query({
        walletAddress,
      });
      console.log('[WalletAuth] Step 2: Got nonce:', nonce);
      
      // Create message
      const message = `Sign in to Polymarket Bot

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This signature will not trigger any blockchain transaction or cost gas.`;
      
      console.log('[WalletAuth] Step 3: Message created, length:', message.length);
      
      // Request signature
      console.log('[WalletAuth] Step 4: Requesting signature...');
      const signature = await signMessageAsync({ message });
      console.log('[WalletAuth] Step 5: Got signature:', signature ? `YES (${signature.length} chars)` : 'NO');
      
      if (!signature) {
        throw new Error('No signature received');
      }
      
      // Prepare input object
      const inputObject = {
        walletAddress,
        message,
        signature,
      };
      
      console.log('[WalletAuth] Step 6: Prepared input object:', {
        walletAddress: inputObject.walletAddress,
        messageLength: inputObject.message.length,
        signatureLength: inputObject.signature.length,
        walletAddressType: typeof inputObject.walletAddress,
        messageType: typeof inputObject.message,
        signatureType: typeof inputObject.signature,
      });
      
      console.log('[WalletAuth] Step 7: Calling verifyMutation.mutateAsync...');
      console.log('[WalletAuth] verifyMutation object:', verifyMutation);
      console.log('[WalletAuth] verifyMutation.mutateAsync type:', typeof verifyMutation.mutateAsync);
      
      // Call mutation
      const result = await verifyMutation.mutateAsync(inputObject);
      
      console.log('[WalletAuth] Step 8: Got result:', result);
      
      if (result.success && result.token) {
        console.log('[WalletAuth] Step 9: SUCCESS! Storing token');
        localStorage.setItem('wallet_token', result.token);
        setLocation('/dashboard');
      } else {
        console.error('[WalletAuth] Step 9: FAILED - no token in result');
        throw new Error('Authentication failed - no token received');
      }
    } catch (error: any) {
      console.error('[WalletAuth] ERROR:', error);
      console.error('[WalletAuth] Error message:', error.message);
      console.error('[WalletAuth] Error stack:', error.stack);
      setAuthError(error.message || 'Authentication failed');
      disconnect();
    } finally {
      setIsAuthenticating(false);
      console.log('[WalletAuth] END');
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
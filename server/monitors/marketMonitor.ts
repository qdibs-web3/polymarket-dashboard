/**
 * Market Monitor
 * Monitors Polymarket markets and price feeds
 */

import WebSocket from 'ws';
import { ethers } from 'ethers';
import { MarketData, PriceData } from './types';

// Chainlink BTC/USD Price Feed ABI (only what we need)
const CHAINLINK_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

export class MarketMonitor {
  private static instance: MarketMonitor | null = null;
  private ws: WebSocket | null = null;
  private provider: ethers.JsonRpcProvider;
  private chainlinkFeed: ethers.Contract;
  private currentMarket: MarketData | null = null;
  private isConnected: boolean = false;
  
  private constructor() {
    // Initialize Polygon provider
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Initialize Chainlink price feed
    const chainlinkAddress = process.env.CHAINLINK_BTC_USD_AGGREGATOR || 
      '0xc907E116054Ad103354f2D350FD2514433D57F6f';
    this.chainlinkFeed = new ethers.Contract(chainlinkAddress, CHAINLINK_ABI, this.provider);
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): MarketMonitor {
    if (!MarketMonitor.instance) {
      MarketMonitor.instance = new MarketMonitor();
    }
    return MarketMonitor.instance;
  }
  
  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    await this.connectWebSocket();
    console.log('[MarketMonitor] Started');
  }
  
  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    console.log('[MarketMonitor] Stopped');
  }
  
  /**
   * Connect to Polymarket WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    const wsUrl = process.env.POLYMARKET_LIVE_WS_URL || 'wss://ws-live-data.polymarket.com';
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      console.log('[MarketMonitor] WebSocket connected');
      this.isConnected = true;
      
      // Subscribe to BTC 15m markets
      const seriesId = process.env.POLYMARKET_SERIES_ID || '10192';
      this.ws?.send(JSON.stringify({
        type: 'subscribe',
        channel: 'series',
        seriesId: seriesId
      }));
    });
    
    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('[MarketMonitor] Error parsing WebSocket message:', error);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error('[MarketMonitor] WebSocket error:', error);
      this.isConnected = false;
    });
    
    this.ws.on('close', () => {
      console.log('[MarketMonitor] WebSocket closed, reconnecting in 5s...');
      this.isConnected = false;
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }
  
  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(message: any): void {
    if (message.type === 'market_update' && message.data) {
      // Update current market data
      this.currentMarket = {
        id: message.data.id,
        question: message.data.question,
        yesPrice: parseFloat(message.data.yesPrice),
        noPrice: parseFloat(message.data.noPrice),
        volume: parseFloat(message.data.volume || '0'),
        liquidity: parseFloat(message.data.liquidity || '0'),
        expiresAt: new Date(message.data.expiresAt),
        slug: message.data.slug,
      };
    }
  }
  
  /**
   * Get current active market
   */
  async getCurrentMarket(): Promise<MarketData | null> {
    // If WebSocket has data, return it
    if (this.currentMarket) {
      return this.currentMarket;
    }
    
    // Otherwise, fetch from HTTP API
    try {
      const seriesSlug = process.env.POLYMARKET_SERIES_SLUG || 'btc-up-or-down-15m';
      const response = await fetch(`https://clob.polymarket.com/series/${seriesSlug}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Find the active market (not expired)
      const now = new Date();
      const activeMarket = data.markets?.find((m: any) => new Date(m.expiresAt) > now);
      
      if (!activeMarket) {
        return null;
      }
      
      this.currentMarket = {
        id: activeMarket.id,
        question: activeMarket.question,
        yesPrice: parseFloat(activeMarket.yesPrice),
        noPrice: parseFloat(activeMarket.noPrice),
        volume: parseFloat(activeMarket.volume || '0'),
        liquidity: parseFloat(activeMarket.liquidity || '0'),
        expiresAt: new Date(activeMarket.expiresAt),
        slug: activeMarket.slug,
      };
      
      return this.currentMarket;
    } catch (error) {
      console.error('[MarketMonitor] Error fetching market:', error);
      return null;
    }
  }
  
  /**
   * Get current BTC price from Chainlink
   */
  async getCurrentPrice(): Promise<PriceData | null> {
    try {
      const roundData = await this.chainlinkFeed.latestRoundData();
      
      // Chainlink returns price with 8 decimals
      const price = Number(roundData.answer) / 1e8;
      const timestamp = new Date(Number(roundData.updatedAt) * 1000);
      
      return {
        price,
        timestamp,
        source: 'chainlink',
      };
    } catch (error) {
      console.error('[MarketMonitor] Error fetching Chainlink price:', error);
      
      // Fallback to Binance API
      return this.getBinancePrice();
    }
  }
  
  /**
   * Get BTC price from Binance (fallback)
   */
  private async getBinancePrice(): Promise<PriceData | null> {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const data = await response.json();
      
      return {
        price: parseFloat(data.price),
        timestamp: new Date(),
        source: 'binance',
      };
    } catch (error) {
      console.error('[MarketMonitor] Error fetching Binance price:', error);
      return null;
    }
  }
  
  /**
   * Check if monitor is connected
   */
  isConnectedToWebSocket(): boolean {
    return this.isConnected;
  }
  
  /**
   * Get historical prices (for backtesting)
   */
  async getHistoricalPrices(minutes: number = 60): Promise<PriceData[]> {
    try {
      const interval = '1m';
      const limit = minutes;
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`
      );
      
      const data = await response.json();
      
      return data.map((candle: any) => ({
        price: parseFloat(candle[4]), // Close price
        timestamp: new Date(candle[0]),
        source: 'binance' as const,
      }));
    } catch (error) {
      console.error('[MarketMonitor] Error fetching historical prices:', error);
      return [];
    }
  }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PolymarketBotProxy.sol";

/**
 * @title SubscriptionManager
 * @notice Handles USDC subscription payments and manages bot access
 * @dev Integrates with PolymarketBotProxy for trading permissions
 */
contract SubscriptionManager is Ownable, Pausable, ReentrancyGuard {
    
    enum Tier { NONE, BASIC, PRO, PREMIUM }
    
    struct Subscription {
        Tier tier;
        uint256 expiresAt;
        uint256 lastPayment;
        bool isActive;
    }
    
    address public constant USDC = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359; // Polygon USDC
    address public treasury;
    PolymarketBotProxy public botProxy;
    
    // Subscription prices in USDC (6 decimals)
    uint256 public constant BASIC_PRICE = 60 * 1e6;      // $60
    uint256 public constant PRO_PRICE = 150 * 1e6;       // $150
    uint256 public constant PREMIUM_PRICE = 300 * 1e6;   // $300
    
    // Subscription duration (30 days)
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;
    
    mapping(address => Subscription) public subscriptions;
    
    event SubscriptionPurchased(address indexed user, Tier tier, uint256 amount, uint256 expiresAt);
    event SubscriptionRenewed(address indexed user, Tier tier, uint256 expiresAt);
    event SubscriptionCanceled(address indexed user);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event BotProxyUpdated(address indexed oldProxy, address indexed newProxy);
    
    constructor(address _usdc, address _botProxy, address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_botProxy != address(0), "Invalid bot proxy");
        treasury = _treasury;
        botProxy = PolymarketBotProxy(_botProxy);
    }
    
    /**
     * @notice Purchase a subscription
     * @param tier The subscription tier to purchase
     */
    function subscribe(Tier tier) external whenNotPaused nonReentrant {
        require(tier != Tier.NONE, "Invalid tier");
        
        uint256 price = getTierPrice(tier);
        require(price > 0, "Invalid tier price");
        
        // Check USDC allowance
        uint256 allowance = IERC20(USDC).allowance(msg.sender, address(this));
        require(allowance >= price, "Insufficient USDC allowance");
        
        // Transfer USDC to treasury
        bool success = IERC20(USDC).transferFrom(msg.sender, treasury, price);
        require(success, "USDC transfer failed");
        
        Subscription storage sub = subscriptions[msg.sender];
        
        // Calculate expiration
        uint256 expiresAt;
        if (sub.isActive && sub.expiresAt > block.timestamp) {
            // Extend existing subscription
            expiresAt = sub.expiresAt + SUBSCRIPTION_DURATION;
        } else {
            // New subscription
            expiresAt = block.timestamp + SUBSCRIPTION_DURATION;
        }
        
        // Update subscription
        sub.tier = tier;
        sub.expiresAt = expiresAt;
        sub.lastPayment = block.timestamp;
        sub.isActive = true;
        
        // Grant trading access in bot proxy
        PolymarketBotProxy.SubscriptionTier proxyTier = convertTier(tier);
        
        // Set default trading config based on tier
        (uint256 maxTradeSize, uint256 dailyLimit) = getDefaultLimits(tier);
        
        // Note: User must call botProxy.setTradingConfig themselves
        // We emit event for backend to track
        
        emit SubscriptionPurchased(msg.sender, tier, price, expiresAt);
    }
    
    /**
     * @notice Renew an existing subscription
     */
    function renew() external whenNotPaused nonReentrant {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.tier != Tier.NONE, "No active subscription");
        
        uint256 price = getTierPrice(sub.tier);
        
        // Check USDC allowance
        uint256 allowance = IERC20(USDC).allowance(msg.sender, address(this));
        require(allowance >= price, "Insufficient USDC allowance");
        
        // Transfer USDC to treasury
        bool success = IERC20(USDC).transferFrom(msg.sender, treasury, price);
        require(success, "USDC transfer failed");
        
        // Extend subscription
        if (sub.expiresAt > block.timestamp) {
            sub.expiresAt += SUBSCRIPTION_DURATION;
        } else {
            sub.expiresAt = block.timestamp + SUBSCRIPTION_DURATION;
        }
        
        sub.lastPayment = block.timestamp;
        sub.isActive = true;
        
        emit SubscriptionRenewed(msg.sender, sub.tier, sub.expiresAt);
    }
    
    /**
     * @notice Cancel subscription (revoke bot access)
     */
    function cancel() external {
        Subscription storage sub = subscriptions[msg.sender];
        sub.isActive = false;
        
        emit SubscriptionCanceled(msg.sender);
    }
    
    /**
     * @notice Check if user has active subscription
     */
    function hasActiveSubscription(address user) external view returns (bool) {
        Subscription memory sub = subscriptions[user];
        return sub.isActive && sub.expiresAt > block.timestamp;
    }
    
    /**
     * @notice Get user's subscription info
     */
    function getSubscription(address user) external view returns (
        Tier tier,
        uint256 expiresAt,
        uint256 lastPayment,
        bool isActive,
        bool isExpired
    ) {
        Subscription memory sub = subscriptions[user];
        return (
            sub.tier,
            sub.expiresAt,
            sub.lastPayment,
            sub.isActive,
            sub.expiresAt <= block.timestamp
        );
    }
    
    /**
     * @notice Get tier price
     */
    function getTierPrice(Tier tier) public pure returns (uint256) {
        if (tier == Tier.BASIC) return BASIC_PRICE;
        if (tier == Tier.PRO) return PRO_PRICE;
        if (tier == Tier.PREMIUM) return PREMIUM_PRICE;
        return 0;
    }
    
    /**
     * @notice Get default trading limits for tier
     */
    function getDefaultLimits(Tier tier) public pure returns (uint256 maxTradeSize, uint256 dailyLimit) {
        if (tier == Tier.BASIC) return (100 * 1e6, 1000 * 1e6);
        if (tier == Tier.PRO) return (500 * 1e6, 5000 * 1e6);
        if (tier == Tier.PREMIUM) return (10000 * 1e6, 100000 * 1e6);
        return (0, 0);
    }
    
    /**
     * @notice Convert Tier to PolymarketBotProxy.SubscriptionTier
     */
    function convertTier(Tier tier) internal pure returns (PolymarketBotProxy.SubscriptionTier) {
        if (tier == Tier.BASIC) return PolymarketBotProxy.SubscriptionTier.BASIC;
        if (tier == Tier.PRO) return PolymarketBotProxy.SubscriptionTier.PRO;
        if (tier == Tier.PREMIUM) return PolymarketBotProxy.SubscriptionTier.PREMIUM;
        return PolymarketBotProxy.SubscriptionTier.NONE;
    }
    
    /**
     * @notice Update treasury address
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    /**
     * @notice Update bot proxy address
     */
    function updateBotProxy(address _newBotProxy) external onlyOwner {
        require(_newBotProxy != address(0), "Invalid address");
        address oldProxy = address(botProxy);
        botProxy = PolymarketBotProxy(_newBotProxy);
        emit BotProxyUpdated(oldProxy, _newBotProxy);
    }
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}

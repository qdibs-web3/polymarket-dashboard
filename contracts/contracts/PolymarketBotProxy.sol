// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PolymarketBotProxy
 * @notice Non-custodial proxy for Polymarket trading bot
 * @dev Users approve USDC spending, bot executes trades within limits
 */
contract PolymarketBotProxy is Ownable, Pausable, ReentrancyGuard {
    
    enum SubscriptionTier { NONE, BASIC, PRO, ENTERPRISE }
    
    struct TradingConfig {
        uint256 maxTradeSize;
        uint256 dailySpendLimit;
        uint256 spentToday;
        uint256 lastResetDay;
        bool isActive;
        SubscriptionTier tier;
    }
    
    address public botWallet;
    address public constant USDC = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359; // Polygon Mumbai USDC
    
    mapping(address => TradingConfig) public userConfigs;
    mapping(SubscriptionTier => uint256) public tierMaxTradeSize;
    mapping(SubscriptionTier => uint256) public tierDailyLimit;
    
    event TradingConfigSet(address indexed user, uint256 maxTradeSize, uint256 dailyLimit, SubscriptionTier tier);
    event TradingAccessRevoked(address indexed user);
    event TradeExecuted(address indexed user, address indexed token, uint256 amount);
    event BotWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event EmergencyWithdraw(address indexed user, address indexed token, uint256 amount);
    event TierLimitsUpdated(SubscriptionTier tier, uint256 maxTradeSize, uint256 dailyLimit);
    
    modifier onlyBot() {
        require(msg.sender == botWallet, "Only bot can execute");
        _;
    }
    
    constructor(address _botWallet) Ownable(msg.sender) {
        require(_botWallet != address(0), "Invalid bot wallet");
        botWallet = _botWallet;
        
        // Set tier limits (USDC has 6 decimals)
        tierMaxTradeSize[SubscriptionTier.BASIC] = 100 * 1e6;        // $100
        tierMaxTradeSize[SubscriptionTier.PRO] = 500 * 1e6;          // $500
        tierMaxTradeSize[SubscriptionTier.ENTERPRISE] = 10000 * 1e6; // $10,000
        
        tierDailyLimit[SubscriptionTier.BASIC] = 1000 * 1e6;         // $1,000
        tierDailyLimit[SubscriptionTier.PRO] = 5000 * 1e6;           // $5,000
        tierDailyLimit[SubscriptionTier.ENTERPRISE] = 100000 * 1e6;  // $100,000
    }
    
    function setTradingConfig(
        uint256 _maxTradeSize,
        uint256 _dailyLimit,
        SubscriptionTier _tier
    ) external {
        require(_tier != SubscriptionTier.NONE, "Invalid tier");
        require(_maxTradeSize > 0 && _dailyLimit > 0, "Limits must be > 0");
        require(_maxTradeSize <= tierMaxTradeSize[_tier], "Max trade exceeds tier limit");
        require(_dailyLimit <= tierDailyLimit[_tier], "Daily limit exceeds tier limit");
        require(_maxTradeSize <= _dailyLimit, "Max trade cannot exceed daily limit");
        
        TradingConfig storage config = userConfigs[msg.sender];
        config.maxTradeSize = _maxTradeSize;
        config.dailySpendLimit = _dailyLimit;
        config.tier = _tier;
        config.isActive = true;
        config.lastResetDay = block.timestamp / 1 days;
        config.spentToday = 0;
        
        emit TradingConfigSet(msg.sender, _maxTradeSize, _dailyLimit, _tier);
    }
    
    function revokeTradingAccess() external {
        userConfigs[msg.sender].isActive = false;
        emit TradingAccessRevoked(msg.sender);
    }
    
    function executeTrade(
        address user,
        address token,
        uint256 amount
    ) external onlyBot whenNotPaused nonReentrant {
        require(user != address(0), "Invalid user");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        
        TradingConfig storage config = userConfigs[user];
        require(config.isActive, "Trading not active");
        require(config.tier != SubscriptionTier.NONE, "No subscription");
        require(amount <= config.maxTradeSize, "Exceeds max trade size");
        
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > config.lastResetDay) {
            config.spentToday = 0;
            config.lastResetDay = currentDay;
        }
        
        require(config.spentToday + amount <= config.dailySpendLimit, "Daily limit exceeded");
        
        uint256 allowance = IERC20(token).allowance(user, address(this));
        require(allowance >= amount, "Insufficient allowance");
        
        bool success = IERC20(token).transferFrom(user, botWallet, amount);
        require(success, "Transfer failed");
        
        config.spentToday += amount;
        emit TradeExecuted(user, token, amount);
    }
    
    function emergencyWithdraw(address token) external nonReentrant {
        require(token != address(0), "Invalid token");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance");
        
        bool success = IERC20(token).transfer(msg.sender, balance);
        require(success, "Transfer failed");
        
        emit EmergencyWithdraw(msg.sender, token, balance);
    }
    
    function updateBotWallet(address _newBotWallet) external onlyOwner {
        require(_newBotWallet != address(0), "Invalid address");
        address oldWallet = botWallet;
        botWallet = _newBotWallet;
        emit BotWalletUpdated(oldWallet, _newBotWallet);
    }
    
    function updateTierLimits(
        SubscriptionTier _tier,
        uint256 _maxTradeSize,
        uint256 _dailyLimit
    ) external onlyOwner {
        require(_tier != SubscriptionTier.NONE, "Cannot update NONE tier");
        require(_maxTradeSize > 0 && _dailyLimit > 0, "Limits must be > 0");
        require(_maxTradeSize <= _dailyLimit, "Max trade cannot exceed daily limit");
        
        tierMaxTradeSize[_tier] = _maxTradeSize;
        tierDailyLimit[_tier] = _dailyLimit;
        
        emit TierLimitsUpdated(_tier, _maxTradeSize, _dailyLimit);
    }
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    
    function getTierLimits(SubscriptionTier tier) external view returns (uint256, uint256) {
        return (tierMaxTradeSize[tier], tierDailyLimit[tier]);
    }
    
    function getUserConfig(address user) external view returns (TradingConfig memory) {
        return userConfigs[user];
    }
    
    function checkAllowance(address user, address token) external view returns (uint256) {
        return IERC20(token).allowance(user, address(this));
    }
    
    function canTrade(address user, uint256 amount) external view returns (bool, string memory) {
        TradingConfig memory config = userConfigs[user];
        
        if (!config.isActive) return (false, "Trading not active");
        if (config.tier == SubscriptionTier.NONE) return (false, "No subscription");
        if (amount > config.maxTradeSize) return (false, "Exceeds max trade size");
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 spentToday = currentDay > config.lastResetDay ? 0 : config.spentToday;
        
        if (spentToday + amount > config.dailySpendLimit) return (false, "Exceeds daily limit");
        if (paused()) return (false, "Contract paused");
        
        return (true, "");
    }
}
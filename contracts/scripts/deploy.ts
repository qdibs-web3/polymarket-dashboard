const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC");
  
  const botWalletAddress = process.env.BOT_HOT_WALLET_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  const usdcAddress = process.env.USDC_ADDRESS;
  const existingProxyAddress = process.env.BOT_PROXY_ADDRESS;

  if (!usdcAddress) {
    throw new Error("USDC_ADDRESS not set in .env");
  }

  console.log("Treasury address:", treasuryAddress);
  console.log("USDC address:", usdcAddress);

  // Deploy PolymarketBotProxy — skip if BOT_PROXY_ADDRESS is already set
  let proxyAddress: string;
  if (existingProxyAddress) {
    proxyAddress = existingProxyAddress;
    console.log("\n⏭️  Skipping PolymarketBotProxy deploy — using existing:", proxyAddress);
  } else {
    if (!botWalletAddress) {
      throw new Error("BOT_HOT_WALLET_ADDRESS not set in .env (required when BOT_PROXY_ADDRESS is not set)");
    }
    console.log("Bot wallet address:", botWalletAddress);
    console.log("\n📦 Deploying PolymarketBotProxy...");
    const PolymarketBotProxy = await hre.ethers.getContractFactory("PolymarketBotProxy");
    const proxy = await PolymarketBotProxy.deploy(botWalletAddress);
    await proxy.waitForDeployment();
    proxyAddress = await proxy.getAddress();
    console.log("✅ PolymarketBotProxy deployed to:", proxyAddress);
  }
  
  // Deploy SubscriptionManager
  console.log("\n📦 Deploying SubscriptionManager...");
  const SubscriptionManager = await hre.ethers.getContractFactory("SubscriptionManager");
  const subscriptionManager = await SubscriptionManager.deploy(
    usdcAddress,     // _usdc
    proxyAddress,    // _botProxy
    treasuryAddress  // _treasury
  );
  await subscriptionManager.waitForDeployment();
  const subscriptionAddress = await subscriptionManager.getAddress();
  console.log("✅ SubscriptionManager deployed to:", subscriptionAddress);
  
  // Grant SubscriptionManager permission to update tiers in BotProxy
  console.log("\n🔐 Granting SubscriptionManager permission to update tiers...");
  // Note: You'll need to add a function in PolymarketBotProxy to allow SubscriptionManager to call setUserTier
  // For now, the owner (deployer) will need to manually update tiers or add access control
  
  console.log("\n" + "=".repeat(60));
  console.log("📝 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("\n✅ PolymarketBotProxy:", proxyAddress);
  console.log("✅ SubscriptionManager:", subscriptionAddress);
  
  console.log("\n📋 Add these to your ROOT .env file:");
  console.log("─".repeat(60));
  console.log(`PROXY_CONTRACT_ADDRESS=${proxyAddress}`);
  console.log(`SUBSCRIPTION_CONTRACT_ADDRESS=${subscriptionAddress}`);
  console.log("─".repeat(60));
  
  console.log("\n📊 Subscription Tiers:");
  const basicPrice = await subscriptionManager.getTierPrice(1);
  const proPrice = await subscriptionManager.getTierPrice(2);
  const premiumPrice = await subscriptionManager.getTierPrice(3);
  
  console.log("  BASIC:   $" + hre.ethers.formatUnits(basicPrice, 6) + " USDC/month");
  console.log("  PRO:     $" + hre.ethers.formatUnits(proPrice, 6) + " USDC/month");
  console.log("  PREMIUM: $" + hre.ethers.formatUnits(premiumPrice, 6) + " USDC/month");
  
  console.log("\n📊 Bot Proxy Tier Limits:");
  try {
    const PolymarketBotProxyArtifact = await hre.ethers.getContractFactory("PolymarketBotProxy");
    const proxyContract = PolymarketBotProxyArtifact.attach(proxyAddress);
    const basicLimits = await proxyContract.getTierLimits(1);
    console.log("  BASIC:   Max Trade:", hre.ethers.formatUnits(basicLimits[0], 6), "USDC | Daily:", hre.ethers.formatUnits(basicLimits[1], 6), "USDC");
    const proLimits = await proxyContract.getTierLimits(2);
    console.log("  PRO:     Max Trade:", hre.ethers.formatUnits(proLimits[0], 6), "USDC | Daily:", hre.ethers.formatUnits(proLimits[1], 6), "USDC");
    const premiumLimits = await proxyContract.getTierLimits(3);
    console.log("  PREMIUM: Max Trade:", hre.ethers.formatUnits(premiumLimits[0], 6), "USDC | Daily:", hre.ethers.formatUnits(premiumLimits[1], 6), "USDC");
  } catch (e) {
    console.log("  (Could not read tier limits from proxy)");
  }
  
  console.log("\n🔍 Verify on PolygonScan (Amoy):");
  console.log("─".repeat(60));
  console.log(`npx hardhat verify --network amoy ${proxyAddress} "${botWalletAddress}"`);
  console.log(`npx hardhat verify --network amoy ${subscriptionAddress} "${usdcAddress}" "${proxyAddress}" "${treasuryAddress}"`);
  console.log("─".repeat(60));
  
  console.log("\n⚠️  IMPORTANT NEXT STEPS:");
  console.log("1. Update PolymarketBotProxy to allow SubscriptionManager to call setUserTier");
  console.log("2. Or manually update user tiers after they subscribe");
  console.log("3. Get Amoy testnet USDC from faucet for testing");
  console.log("4. Update frontend with contract addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
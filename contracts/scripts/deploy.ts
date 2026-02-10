const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC");
  
  const botWalletAddress = process.env.BOT_HOT_WALLET_ADDRESS;
  
  if (!botWalletAddress) {
    throw new Error("BOT_HOT_WALLET_ADDRESS not set in .env");
  }
  
  console.log("Bot wallet address:", botWalletAddress);
  console.log("\nDeploying PolymarketBotProxy...");
  
  const PolymarketBotProxy = await hre.ethers.getContractFactory("PolymarketBotProxy");
  const proxy = await PolymarketBotProxy.deploy(botWalletAddress);
  
  await proxy.waitForDeployment();
  
  const proxyAddress = await proxy.getAddress();
  
  console.log("\n✅ PolymarketBotProxy deployed to:", proxyAddress);
  console.log("\n📝 Add this to your ROOT .env file:");
  console.log(`PROXY_CONTRACT_ADDRESS=${proxyAddress}`);
  
  console.log("\n📊 Tier Limits:");
  const basicLimits = await proxy.getTierLimits(1);
  console.log("  BASIC:      Max Trade:", hre.ethers.formatUnits(basicLimits[0], 6), "USDC | Daily:", hre.ethers.formatUnits(basicLimits[1], 6), "USDC");
  
  const proLimits = await proxy.getTierLimits(2);
  console.log("  PRO:        Max Trade:", hre.ethers.formatUnits(proLimits[0], 6), "USDC | Daily:", hre.ethers.formatUnits(proLimits[1], 6), "USDC");
  
  const enterpriseLimits = await proxy.getTierLimits(3);
  console.log("  ENTERPRISE: Max Trade:", hre.ethers.formatUnits(enterpriseLimits[0], 6), "USDC | Daily:", hre.ethers.formatUnits(enterpriseLimits[1], 6), "USDC");
  
  console.log("\n🔍 Verify on Polygonscan:");
  console.log(`npx hardhat verify --network mumbai ${proxyAddress} "${botWalletAddress}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Smart contract addresses (Polygon Mainnet)
  proxyContractAddress: process.env.PROXY_CONTRACT_ADDRESS ?? "0xA5B9d3E2435ad973BF2020585562811D6d4f8747",
  subscriptionContractAddress: process.env.SUBSCRIPTION_CONTRACT_ADDRESS ?? "0xE32b25a366ab56357c014A44bf1Dd1140761bEdc",
  polygonRpcUrl: process.env.POLYGON_RPC_URL ?? "https://polygon-bor-rpc.publicnode.com",
};
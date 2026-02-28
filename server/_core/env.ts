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
  // ── Subscription contract (SubscriptionManager on Polygon Mainnet)
  subscriptionContractAddress: process.env.SUBSCRIPTION_CONTRACT_ADDRESS ?? "0xE32b25a366ab56357c014A44bf1Dd1140761bEdc",
  polygonRpcUrl: process.env.POLYGON_RPC_URL ?? "https://polygon-bor-rpc.publicnode.com",

  // ── Bot signing key.The server-side private key used to sign EIP-712 CLOB orders.
  // This wallet must hold USDC on Polygon and have approved the CTF Exchange.
  botPrivateKey: process.env.BOT_PRIVATE_KEY ?? "",
};